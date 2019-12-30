var ipcRenderer = require('electron').ipcRenderer;
window.onload = function () {
    getMylistToken();
};
//IPC通信
function showLoginWindow() {
    //ログイン画面を表示しろとメインプロセスへ送信
    ipcRenderer.send('login', 'show');
}
function showSettingWindow() {
    //設定画面を表示しろとメインプロセスへ送信
    ipcRenderer.send('setting', 'show');
}
var heartbeatInterval = null;
var nextVideoTimeout = null;
//動画ID
var videoId = "";
//動画タイトル
var videoTitle = "";
//動画サムネイル
var videoThumbnail = "";
//動画時間
var videoLength = 0;
//マイリスの動画配列
var mylistList = [];
//リピート再生
var repeatInterval = null;
var isRepeat = false;
//ニコニコ動画のHTML取得
function getNicoVideoHTML() {
    var request = require('request');
    if (heartbeatInterval != null) {
        clearInterval(heartbeatInterval);
    }
    if (repeatInterval != null) {
        clearInterval(repeatInterval);
    }
    //次の曲スイッチ
    var nextSwitch = document.getElementById('next_video_check');
    // HTMLInputElement じゃないと value ない
    var input = document.getElementById('video_id_input');
    videoId = input.value;
    //user_session
    var user_session = localStorage.getItem('user_session');
    if (user_session == null) {
        return;
    }
    //URL
    var url = "https://www.nicovideo.jp/watch/" + videoId;
    //リクエスト。XMLHttpRequestだとCookie付けられなかった。
    //ヘッダー
    var headers = {
        'Cookie': "user_session=" + user_session,
        'User-Agent': 'NicoHome;@takusan_23'
    };
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers
    };
    request(options, function (error, response, body) {
        if (response.statusCode == 200) {
            //HTMLスクレイピング
            var dom = new DOMParser();
            var nicoVideoHTML = dom.parseFromString(body, 'text/html');
            //JSONあるDiv要素を探す
            var jsonDiv = nicoVideoHTML.getElementById('js-initial-watch-data');
            var jsonString = jsonDiv.getAttribute('data-api-data');
            //dmcInfoがJSONに存在するかで分岐。
            var json = JSON.parse(jsonString);
            //タイトルとサムネイル  
            videoTitle = json.video.title;
            videoThumbnail = json.video.largeThumbnailURL;
            if (json.video.dmcInfo != null) {
                //再生時間取得
                videoLength = json.video.dmcInfo.video.length_seconds;
                //存在するとき、APIを叩いてURLをもらう。新サーバーの動画？DMC？
                //すべての動画が変換されているわけではない模様。
                getContentURL(jsonString);
            }
            else {
                //昔の動画でも変換してる場合もあるんだけどなんで？
                //dmcInfo無いときはHTMLのJSONの中に動画URLがあるのでそっち使う。
                //なんかしらんけどsmileさーばーの動画再生できない。
                var url_1 = json.video.smileInfo.url;
                console.log(url_1);
                //  playGoogleHome(url)
                M.toast({ html: 'smileサーバーの動画は再生できません。' });
                //マイリスで次の曲に自動で移動する場合は
                if (nextSwitch.checked) {
                    loadNextVideo();
                }
            }
        }
    });
}
function getContentURL(jsonString) {
    //ニコニコ動画の動画URLを取得する。くっそめんどい。もう一度（二回）APIを叩かないといけない模様。
    //URL
    var url = "https://api.dmc.nico/api/sessions?_format=json";
    //HTMLのJSON
    var json = JSON.parse(jsonString);
    // console.log(json.video.dmcInfo.session_api)
    var jsonSessionAPI = json.video.dmcInfo.session_api;
    var jsonStoryboardSessionAPI = json.video.dmcInfo.storyboard_session_api;
    // session_api 
    var sessionApi = {
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
    };
    //１つ目のAPIを叩く。sessionAPIをPOST。content_idがout1のやつ。
    //content_idがout1のやつだと、content_uriで動画リンクが取れる。
    //リクエスト
    var request = require('request');
    //ヘッダー
    var headers = {
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/json'
    };
    //オプション
    var options_one = {
        url: url,
        method: 'POST',
        headers: headers,
        json: sessionApi
    };
    request(options_one, function (error, response, body) {
        console.log('APIレスポンス session_api');
        console.log(body);
        var responseJSON = body;
        //content_uri 動画リンク。
        var content_uri = responseJSON.data.session.content_uri;
        var id = responseJSON.data.session.id;
        //再生
        playGoogleHome(content_uri);
        //  40秒ごとに視聴継続メッセージを送信する。
        //  これしないと鯖が「動画送るのやーめた」って切られちゃうので。めんどい。
        heartbeatInterval = setInterval(function () {
            //URL構築
            var sessionAPIURL = "https://api.dmc.nico/api/sessions/" + id + "?_format=json&_method=PUT";
            //視聴継続メッセージ送信
            var request = require('request');
            //ヘッダー
            var headers = {
                'User-Agent': 'NicoHome;@takusan_23',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            //オプション
            var options = {
                url: sessionAPIURL,
                method: 'POST',
                headers: headers,
                json: responseJSON.data
            };
            console.log(sessionAPIURL);
            console.log(responseJSON.data);
            request(options, function (error, response, body) {
                console.log('視聴継続メッセージ送信 40秒ごと');
                console.log(response.statusCode);
                console.log(body);
            });
        }, 40 * 1000);
        //URL構築
        var sessionAPIURL = "https://api.dmc.nico/api/sessions/" + id + "?_format=json&_method=PUT";
        //視聴継続メッセージ送信
        var request = require('request');
        //ヘッダー
        var headers = {
            'User-Agent': 'NicoHome;@takusan_23',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        //オプション
        var options = {
            url: sessionAPIURL,
            method: 'POST',
            headers: headers,
            json: responseJSON.data
        };
        request(options, function (error, response, body) {
            console.log('視聴継続メッセージ送信');
            console.log(response.statusCode);
            console.log(body);
        });
    });
    //JSONにstoryboard_session_apiが無いときある？
    if (json.video.dmcInfo.storyboard_session_api != null) {
        //StoryboardSessionAPI
        var storyboardSessionAPI = {
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
        };
        //２つ目のAPIを叩く。storyboardSessionAPIをPOST。content_idがsb_out1のやつ。
        //これを叩いたらすぐにjson.data.session.idを取ってURLを構築してレスポンスをPOSTする。
        var request_1 = require('request');
        //ヘッダー
        var headers = {
            'User-Agent': 'NicoHome;@takusan_23',
            'Content-Type': 'application/json'
        };
        //オプション
        var options = {
            url: url,
            method: 'POST',
            headers: headers,
            json: storyboardSessionAPI
        };
        request_1(options, function (error, response, body) {
            console.log('APIレスポンス storyboardSessionAPI');
            console.log(body);
            var responseJSON = body;
            var id = responseJSON.data.session.id;
            //URL構築
            var sessionAPIURL = "https://api.dmc.nico/api/sessions/" + id + "?_format=json&_method=DELETE";
            //視聴継続メッセージ送信（これは一度だけ）
            var request = require('request');
            //ヘッダー
            var headers = {
                'User-Agent': 'NicoHome;@takusan_23',
                'Content-Type': 'application/json'
            };
            //オプション
            var options = {
                url: sessionAPIURL,
                method: 'POST',
                headers: headers,
                json: responseJSON.data
            };
            request(options, function (error, response, body) {
                console.log('視聴継続メッセージ送信 一度だけ');
                console.log(body);
            });
        });
    }
}
function playGoogleHome(url) {
    //プレイヤーのHTML
    var playStateButton = document.getElementById('playStateButton');
    var playerImg = document.getElementById('player_img');
    playerImg.src = videoThumbnail;
    var playStateIcon = document.getElementById('player_controll_icon');
    playStateIcon.innerHTML = 'pause';
    var playerTitle = document.getElementById('player_title');
    playerTitle.innerText = videoTitle;
    var isNext = document.getElementById('next_video_check');
    var repeatButton = document.getElementById('repeat_button');
    var isPlaying = false;
    // google-home-notifierはなんかNode.JSのバージョンがなんとかで動かなかったのでこっちで。
    // 音楽再生だけなのでこっちでも良き
    // 参考：https://ebisu-voice-production.com/blogs/play-mp3-file-locally/
    //ipアドレス取得
    var ipAddress = localStorage.getItem('ip_address');
    if (ipAddress === null) {
        return; //無いなら関数終了
    }
    var _a = require('castv2-client'), Client = _a.Client, DefaultMediaReceiver = _a.DefaultMediaReceiver;
    var host = process.env.HOST || ipAddress;
    var client = new Client();
    client.connect(host, function () {
        client.launch(DefaultMediaReceiver, function (err, player) {
            var media = {
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
            player.load(media, { autoplay: true, repeatMode: "REPEAT_ALL" }, function (err, status) {
                console.log(err, status);
                isPlaying = true;
                //止められるように
                playStateButton.onclick = function () {
                    if (isPlaying) {
                        player.pause(function () {
                            playStateIcon.innerHTML = 'play_arrow';
                        });
                    }
                    else {
                        player.play(function () {
                            playStateIcon.innerHTML = 'pause';
                        });
                    }
                    //反転させとく
                    isPlaying = !isPlaying;
                    clearTimeout(nextVideoTimeout);
                };
            });
            player.on('status', function (status) {
                console.log(status.playerState);
                if (status.playerState == 'PLAYING') {
                    //次の曲？
                    if (isNext.checked) {
                        if (nextVideoTimeout != null) {
                            clearTimeout(nextVideoTimeout);
                        }
                        nextVideoTimeout = setTimeout(function () { loadNextVideo(); }, videoLength * 1000);
                    }
                }
                //リピート再生
                if (repeatInterval != null) {
                    clearTimeout(repeatInterval);
                }
                repeatInterval = setTimeout(function () {
                    if (isRepeat) {
                        getNicoVideoHTML();
                    }
                }, videoLength * 1000);
            });
        });
    });
}
function loadNextVideo() {
    if (mylistList.length != 0) {
        var pos = mylistList.indexOf(videoId);
        var input = document.getElementById('video_id_input');
        input.value = mylistList[pos + 1];
        getNicoVideoHTML();
    }
}
//マイリスト読み込む
function getMylistToken() {
    //user_session取得
    var user_session = localStorage.getItem('user_session');
    if (user_session === null) {
        return; //無いなら関数終了
    }
    var url = 'https://www.nicovideo.jp/my/mylist';
    var request = require('request');
    //ヘッダー
    var headers = {
        'Cookie': "user_session=" + user_session,
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/json'
    };
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers
    };
    request(options, function (error, response, body) {
        var pattern = 'NicoAPI.token = \"(.+?)\";';
        //マイリスト取得に必要なトークン
        var token = body.match(pattern)[1];
        loadMylistList(token);
    });
}
function loadMylistList(nicotoken) {
    //user_session取得
    var user_session = localStorage.getItem('user_session');
    var url = 'https://www.nicovideo.jp/api/mylistgroup/list';
    var request = require('request');
    //ヘッダー
    var headers = {
        'Cookie': "user_session=" + user_session,
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers,
        form: { token: nicotoken }
    };
    request(options, function (error, response, body) {
        var json = JSON.parse(body);
        var list = json.mylistgroup;
        var _loop_1 = function (index) {
            var item = list[index];
            var id = item.id;
            //ボタン作成
            var button = document.createElement('a');
            button.className = 'waves-effect waves-light mylistlist_button';
            button.innerText = item.name;
            button.setAttribute('mylist_id', item.id);
            //追加
            var mylistDiv = document.getElementById('mylist_list_div');
            mylistDiv.append(button);
            //クリックしたら読み込む
            button.onclick = function (e) {
                loadMylist(id, nicotoken);
            };
        };
        for (var index = 0; index < list.length; index++) {
            _loop_1(index);
        }
    });
}
function loadMylist(id, nicotoken) {
    mylistList = [];
    //空にする
    var videolist = document.getElementById('videolist');
    videolist.innerHTML = '';
    //user_session取得
    var user_session = localStorage.getItem('user_session');
    var url = 'https://www.nicovideo.jp/api/mylist/list';
    var request = require('request');
    //ヘッダー
    var headers = {
        'Cookie': "user_session=" + user_session,
        'User-Agent': 'NicoHome;@takusan_23',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers,
        form: { token: nicotoken, group_id: id }
    };
    request(options, function (error, response, body) {
        var json = JSON.parse(body);
        var list = json.mylistitem;
        var _loop_2 = function (index) {
            var item = list[index];
            //Card動的作成
            var parentDiv = document.createElement('div');
            parentDiv.className = 'waves-effect card grey lighten-5 video_card';
            //テキスト
            var span = document.createElement('h6');
            span.className = 'black-text';
            span.innerText = item.item_data.title;
            //サムネ
            var img = document.createElement('img');
            img.src = item.item_data.thumbnail_url;
            img.width = 80;
            //img.height = 90
            //押したとき
            parentDiv.onclick = function () {
                var input = document.getElementById('video_id_input');
                input.value = item.item_data.video_id;
                getNicoVideoHTML();
            };
            parentDiv.append(img);
            parentDiv.append(span);
            videolist.append(parentDiv);
            //配列に入れておく
            mylistList.push(item.item_data.video_id);
        };
        for (var index = 0; index < list.length; index++) {
            _loop_2(index);
        }
    });
}
function setRepeat() {
    var repeatButton = document.getElementById('repeat_button');
    isRepeat = !isRepeat;
    if (isRepeat) {
        repeatButton.getElementsByTagName('i')[0].innerHTML = 'repeat_one';
    }
    else {
        repeatButton.getElementsByTagName('i')[0].innerHTML = 'repeat';
    }
}
//# sourceMappingURL=renderer.js.map