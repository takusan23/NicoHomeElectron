const { ipcRenderer } = require('electron')

window.onload = function () {
    getMylistToken()
}


//IPC通信
function showLoginWindow() {
    //ログイン画面を表示しろとメインプロセスへ送信
    ipcRenderer.send('login', 'show')
}

function showSettingWindow() {
    //設定画面を表示しろとメインプロセスへ送信
    ipcRenderer.send('setting', 'show')
}

let heartbeatInterval: NodeJS.Timeout = null

//動画ID
let videoId = ""
//動画タイトル
let videoTitle = ""
//動画サムネイル
let videoThumbnail = ""

//ニコニコ動画のHTML取得
function getNicoVideoHTML() {
    const request = require('request')

    if (heartbeatInterval != null) {
        clearInterval(heartbeatInterval)
    }

    // HTMLInputElement じゃないと value ない
    const input: HTMLInputElement = <HTMLInputElement>document.getElementById('video_id_input')
    videoId = input.value
    //user_session
    const user_session = localStorage.getItem('user_session')
    if (user_session == null) {
        return
    }
    //URL
    const url = `https://www.nicovideo.jp/watch/${videoId}`
    //リクエスト。XMLHttpRequestだとCookie付けられなかった。
    //ヘッダー
    var headers = {
        'Cookie': `user_session=${user_session}`,
        'User-Agent': 'NicoHome;@takusan_23'
    }
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers,
    }
    request(options, function (error: any, response: any, body: any) {
        if (response.statusCode == 200) {
            //HTMLスクレイピング
            const dom = new DOMParser()
            const nicoVideoHTML = dom.parseFromString(body, 'text/html')
            //JSONあるDiv要素を探す
            const jsonDiv = nicoVideoHTML.getElementById('js-initial-watch-data')
            const jsonString = jsonDiv.getAttribute('data-api-data')
            //dmcInfoがJSONに存在するかで分岐。
            const json = JSON.parse(jsonString)

            //タイトルとサムネイル  
            videoTitle = json.video.title
            videoThumbnail = json.video.largeThumbnailURL

            if (json.video.dmcInfo != null) {
                //存在するとき、APIを叩いてURLをもらう。新サーバーの動画？DMC？
                //すべての動画が変換されているわけではない模様。
                getContentURL(jsonString)
            } else {
                //昔の動画でも変換してる場合もあるんだけどなんで？
                //dmcInfo無いときはHTMLのJSONの中に動画URLがあるのでそっち使う。

                //なんかしらんけどsmileさーばーの動画再生できない。

                const url = json.video.smileInfo.url
                console.log(url)
                //  playGoogleHome(url)

                M.toast({ html: 'smileサーバーの動画は再生できません。' })

            }
        }
    })
}

function getContentURL(jsonString: string) {
    //ニコニコ動画の動画URLを取得する。くっそめんどい。もう一度（二回）APIを叩かないといけない模様。

    //URL
    const url = `https://api.dmc.nico/api/sessions?_format=json`


    //HTMLのJSON
    const json = JSON.parse(jsonString)
    // console.log(json.video.dmcInfo.session_api)

    const jsonSessionAPI = json.video.dmcInfo.session_api
    const jsonStoryboardSessionAPI = json.video.dmcInfo.storyboard_session_api

    // session_api 
    const sessionApi = {
        "session": {
            "recipe_id": jsonSessionAPI.recipe_id,
            "content_id": jsonSessionAPI.content_id,
            "content_type": "movie",
            "content_src_id_sets": [
                {
                    "content_src_ids": [
                        {
                            "src_id_to_mux": {
                                "video_src_ids": jsonSessionAPI.videos,
                                "audio_src_ids": jsonSessionAPI.audios
                            }
                        }
                    ]
                }
            ],
            "timing_constraint": "unlimited",
            "keep_method": {
                "heartbeat": {
                    "lifetime": 120000
                }
            },
            "protocol": {
                "name": "http",
                "parameters": {
                    "http_parameters": {
                        "parameters": {
                            "http_output_download_parameters": {
                                "use_well_known_port": "yes",
                                "use_ssl": "yes",
                                "transfer_preset": "standard2"
                            }
                        }
                    }
                }
            },
            "content_uri": "",
            "session_operation_auth": {
                "session_operation_auth_by_signature": {
                    "token": jsonSessionAPI.token,
                    "signature": jsonSessionAPI.signature
                }
            },
            "content_auth": {
                "auth_type": "ht2",
                "content_key_timeout": 600000,
                "service_id": "nicovideo",
                "service_user_id": jsonSessionAPI.service_user_id
            },
            "client_info": {
                "player_id": jsonSessionAPI.player_id
            },
            "priority": JSON.parse(jsonSessionAPI.token).priority
        }
    }

    //１つ目のAPIを叩く。sessionAPIをPOST。content_idがout1のやつ。
    //content_idがout1のやつだと、content_uriで動画リンクが取れる。
    //リクエスト
    const request = require('request')
    //ヘッダー
    var headers = {
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/json'
    }
    //オプション
    var options_one = {
        url: url,
        method: 'POST',
        headers: headers,
        json: sessionApi
    }
    request(options_one, function (error: any, response: any, body: any) {
        console.log('APIレスポンス session_api');
        console.log(body);
        const responseJSON = body
        //content_uri 動画リンク。
        const content_uri = responseJSON.data.session.content_uri
        const id = responseJSON.data.session.id
        //再生
        playGoogleHome(content_uri)

        //  40秒ごとに視聴継続メッセージを送信する。
        //  これしないと鯖が「動画送るのやーめた」って切られちゃうので。めんどい。
        heartbeatInterval = setInterval(function () {
            //URL構築
            const sessionAPIURL = `https://api.dmc.nico/api/sessions/${id}?_format=json&_method=PUT`
            //視聴継続メッセージ送信
            const request = require('request')
            //ヘッダー
            var headers = {
                'User-Agent': 'NicoHome;@takusan_23',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            //オプション
            var options = {
                url: sessionAPIURL,
                method: 'POST',
                headers: headers,
                json: responseJSON.data
            }
            console.log(sessionAPIURL);
            console.log(responseJSON.data);

            request(options, function (error: any, response: any, body: any) {
                console.log('視聴継続メッセージ送信 40秒ごと')
                console.log(response.statusCode)
                console.log(body)
            })
        }, 40 * 1000)


        //URL構築
        const sessionAPIURL = `https://api.dmc.nico/api/sessions/${id}?_format=json&_method=PUT`
        //視聴継続メッセージ送信
        const request = require('request')
        //ヘッダー
        var headers = {
            'User-Agent': 'NicoHome;@takusan_23',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        //オプション
        var options = {
            url: sessionAPIURL,
            method: 'POST',
            headers: headers,
            json: responseJSON.data
        }
        request(options, function (error: any, response: any, body: any) {
            console.log('視聴継続メッセージ送信')
            console.log(response.statusCode)
            console.log(body)
        })
    })

    //JSONにstoryboard_session_apiが無いときある？
    if (json.video.dmcInfo.storyboard_session_api != null) {
        //StoryboardSessionAPI
        const storyboardSessionAPI = {
            "session": {
                "recipe_id": jsonStoryboardSessionAPI.recipe_id,
                "content_id": jsonStoryboardSessionAPI.content_id,
                "content_type": "video",
                "content_src_id_sets": [
                    {
                        "content_src_ids": jsonStoryboardSessionAPI.videos
                    }
                ],
                "timing_constraint": "unlimited",
                "keep_method": {
                    "heartbeat": {
                        "lifetime": 300000
                    }
                },
                "protocol": {
                    "name": "http",
                    "parameters": {
                        "http_parameters": {
                            "parameters": {
                                "storyboard_download_parameters": {
                                    "use_well_known_port": "yes",
                                    "use_ssl": "yes"
                                }
                            }
                        }
                    }
                },
                "content_uri": "",
                "session_operation_auth": {
                    "session_operation_auth_by_signature": {
                        "token": jsonStoryboardSessionAPI.token,
                        "signature": jsonStoryboardSessionAPI.signature
                    }
                },
                "content_auth": {
                    "auth_type": "ht2",
                    "content_key_timeout": 600000,
                    "service_id": "nicovideo",
                    "service_user_id": jsonStoryboardSessionAPI.service_user_id
                },
                "client_info": {
                    "player_id": JSON.parse(jsonStoryboardSessionAPI.token).player_id
                },
                "priority": JSON.parse(jsonStoryboardSessionAPI.token).priority
            }
        }

        //２つ目のAPIを叩く。storyboardSessionAPIをPOST。content_idがsb_out1のやつ。
        //これを叩いたらすぐにjson.data.session.idを取ってURLを構築してレスポンスをPOSTする。
        const request = require('request')
        //ヘッダー
        var headers = {
            'User-Agent': 'NicoHome;@takusan_23',
            'Content-Type': 'application/json'
        }
        //オプション
        var options = {
            url: url,
            method: 'POST',
            headers: headers,
            json: storyboardSessionAPI
        }
        request(options, function (error: any, response: any, body: any) {
            console.log('APIレスポンス storyboardSessionAPI')
            console.log(body)
            const responseJSON = body
            const id = responseJSON.data.session.id
            //URL構築
            const sessionAPIURL = `https://api.dmc.nico/api/sessions/${id}?_format=json&_method=DELETE`
            //視聴継続メッセージ送信（これは一度だけ）
            const request = require('request')
            //ヘッダー
            var headers = {
                'User-Agent': 'NicoHome;@takusan_23',
                'Content-Type': 'application/json'
            }
            //オプション
            var options = {
                url: sessionAPIURL,
                method: 'POST',
                headers: headers,
                json: responseJSON.data
            }
            request(options, function (error: any, response: any, body: any) {
                console.log('視聴継続メッセージ送信 一度だけ')
                console.log(body)
            })
        })
    }
}

function playGoogleHome(url: string) {

    //プレイヤーのHTML
    const playStateButton = document.getElementById('playStateButton')
    const playerImg = document.getElementById('player_img') as HTMLMediaElement
    playerImg.src = videoThumbnail
    const playStateIcon = document.getElementById('player_controll_icon')
    playStateIcon.innerHTML = 'pause'
    const playerTitle = document.getElementById('player_title')
    playerTitle.innerText = videoTitle

    let isPlaying = false

    // google-home-notifierはなんかNode.JSのバージョンがなんとかで動かなかったのでこっちで。
    // 音楽再生だけなのでこっちでも良き
    // 参考：https://ebisu-voice-production.com/blogs/play-mp3-file-locally/

    //ipアドレス取得
    const ipAddress = localStorage.getItem('ip_address')
    if (ipAddress === null) {
        return //無いなら関数終了
    }

    const { Client, DefaultMediaReceiver } = require('castv2-client');
    const host = process.env.HOST || ipAddress;
    const client = new Client();
    client.connect(host, () => {
        client.launch(DefaultMediaReceiver, (err: any, player: any) => {
            const media = {
                contentId: url,
                contentType: 'video/mp4',
                streamType: 'BUFFERED',
                //メタデータ（名前とかアルバムカバーとか）
                metadata: {
                    type: 0,
                    metadataType: 0,
                    title: videoTitle,
                    images: [
                        { url: videoThumbnail }
                    ]
                }
            };

            player.load(media, { autoplay: true, repeatMode: "REPEAT_ALL" }, (err: any, status: any) => {
                console.log(err, status);
                isPlaying = true

                //止められるように
                playStateButton.onclick = function () {
                    if (isPlaying) {
                        player.pause(function () {
                            playStateIcon.innerHTML = 'play_arrow'
                        })
                    } else {
                        player.play(function () {
                            playStateIcon.innerHTML = 'pause'
                        })
                    }
                    //反転させとく
                    isPlaying = !isPlaying
                }
            });

        });
    });
}


//マイリスト読み込む
function getMylistToken() {
    //user_session取得
    const user_session = localStorage.getItem('user_session')
    if (user_session === null) {
        return //無いなら関数終了
    }
    const url = 'https://www.nicovideo.jp/my/mylist'
    const request = require('request')
    //ヘッダー
    var headers = {
        'Cookie': `user_session=${user_session}`,
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/json'
    }
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers,
    }
    request(options, function (error: any, response: any, body: any) {
        const pattern = 'NicoAPI.token = \"(.+?)\";'
        //マイリスト取得に必要なトークン
        const token = (body as string).match(pattern)[1]

        loadMylistList(token)

    })
}

function loadMylistList(nicotoken: string) {
    //user_session取得
    const user_session = localStorage.getItem('user_session')
    const url = 'https://www.nicovideo.jp/api/mylistgroup/list'
    const request = require('request')
    //ヘッダー
    var headers = {
        'Cookie': `user_session=${user_session}`,
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers,
        form: { token: nicotoken }
    }
    request(options, function (error: any, response: any, body: any) {
        const json = JSON.parse(body)
        const list = json.mylistgroup
        for (let index = 0; index < list.length; index++) {
            const item = list[index];
            const id = item.id
            //ボタン作成
            const button = document.createElement('a')
            button.className = 'waves-effect waves-light mylistlist_button'
            button.innerText = item.name
            button.setAttribute('mylist_id', item.id)
            //追加
            const mylistDiv = document.getElementById('mylist_list_div')
            mylistDiv.append(button)
            //クリックしたら読み込む
            button.onclick = function (e) {
                loadMylist(id, nicotoken)
            }
        }
    })
}

function loadMylist(id: string, nicotoken: string) {
    //空にする
    const videolist = document.getElementById('videolist')
    videolist.innerHTML = ''
    //user_session取得
    const user_session = localStorage.getItem('user_session')
    const url = 'https://www.nicovideo.jp/api/mylist/list'
    const request = require('request')
    //ヘッダー
    var headers = {
        'Cookie': `user_session=${user_session}`,
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers,
        form: { token: nicotoken, group_id: id }
    }
    request(options, function (error: any, response: any, body: any) {
        const json = JSON.parse(body)
        const list = json.mylistitem
        for (let index = 0; index < list.length; index++) {
            const item = list[index];
            //Card動的作成
            const parentDiv = document.createElement('div')
            parentDiv.className = 'waves-effect card grey lighten-5 video_card'
            //テキスト
            const span = document.createElement('h6')
            span.className = 'black-text'
            span.innerText = item.item_data.title
            //サムネ
            const img = document.createElement('img')
            img.src = item.item_data.thumbnail_url
            img.width = 80
            //img.height = 90
            //押したとき
            parentDiv.onclick = function () {
                const input: HTMLInputElement = <HTMLInputElement>document.getElementById('video_id_input')
                input.value = item.item_data.video_id
                getNicoVideoHTML()
            }
            parentDiv.append(img)
            parentDiv.append(span)
            videolist.append(parentDiv)
        }
    })

}