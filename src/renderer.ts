
let heartbeatInterval

//ニコニコ動画のHTML取得
function getNicoVideoHTML() {
    // HTMLInputElement じゃないと value ない
    const input: HTMLInputElement = <HTMLInputElement>document.getElementById('video_id_input')
    const id = input.value
    //URL
    const url = `https://www.nicovideo.jp/watch/${id}`
    //リクエスト
    var xml = new XMLHttpRequest()
    xml.open("GET", url)
    xml.onreadystatechange = function (e) {
        if (xml.status == 200) {
            const html = xml.response
            //解析。
            const dom = new DOMParser()
            const nicoVideoHTML = dom.parseFromString(html, 'text/html')
            //JSONあるDiv要素を探す
            const jsonDiv = nicoVideoHTML.getElementById('js-initial-watch-data')
            const jsonString = jsonDiv.getAttribute('data-api-data')
            getContentURL(jsonString)
        }
    }
    xml.send()
}

function getContentURL(jsonString: string) {
    //ニコニコ動画の動画URLを取得する。くっそめんどい。

    //HTMLのJSON
    const json = JSON.parse(jsonString)
    console.log(json.video.dmcInfo.session_api)

    //送るJSON。長すぎ
    const sendData = {
        "session": {
            "recipe_id": json.video.dmcInfo.session_api.recipe_id,
            "content_id": json.video.dmcInfo.session_api.content_id,
            "content_type": "movie",
            "content_src_id_sets": [
                {
                    "content_src_ids": [
                        {
                            "src_id_to_mux": {
                                "video_src_ids": json.video.dmcInfo.session_api.videos,
                                "audio_src_ids": json.video.dmcInfo.session_api.audios
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
                                "transfer_preset": "",
                                "segment_duration": 6000
                            }
                        }
                    }
                }
            },
            "content_uri": "",
            "session_operation_auth": {
                "session_operation_auth_by_signature": {
                    "token": json.video.dmcInfo.session_api.token,
                    "signature": json.video.dmcInfo.session_api.signature
                }
            },
            "content_auth": {
                "auth_type": "ht2",
                "content_key_timeout": 600000,
                "service_id": "nicovideo",
                "service_user_id": json.video.dmcInfo.session_api.service_user_id
            },
            "client_info": {
                "player_id": json.video.dmcInfo.session_api.player_id
            },
            "priority": 0 //０にするといい？
        }
    }

    //送信
    //URL
    const url = `https://api.dmc.nico/api/sessions?_format=json`
    //リクエスト
    var xml = new XMLHttpRequest()
    xml.open("POST", url)
    xml.onreadystatechange = function (e) {
        const responseJSON = JSON.parse(xml.response)
        console.log(responseJSON);

        //URL
        const contentURL = responseJSON.data.session.content_uri       

        //GoogleHomeで再生
        playGoogleHome(contentURL)

        //id（ハートビートで必要）
        const id = responseJSON.data.session.id
        sendHeartBeat(id, JSON.stringify(responseJSON.data))
        //120秒ごとに送信する
        setInterval(function () {
            sendHeartBeat(id, JSON.stringify(responseJSON.data))
        }, 120 * 1000)
    }
    xml.send(JSON.stringify(sendData))


}

let isFirst = true

function sendHeartBeat(id: string, session: string) {
    //ハートビート（視聴継続メッセージ）送信

    //OPTIONS の方
    var xml = new XMLHttpRequest()
    xml.open("OPTIONS", `https://api.dmc.nico/api/sessions/${id}?_format=json&_method=PUT`)
    xml.onreadystatechange = function (e) {
        isFirst = false
        console.log(xml.status);

    }
    xml.send() //送る内容はapi.dmc.nico/api/sessionsのjson.data.sessionでいいらしい。


    //POST の方
    var xml = new XMLHttpRequest()
    xml.open("POST", `https://api.dmc.nico/api/sessions/${id}?_format=json&_method=PUT`)
    xml.onreadystatechange = function (e) {
        isFirst = false
        console.log(xml.status);

    }
    xml.send(session) //送る内容はapi.dmc.nico/api/sessionsのjson.data.sessionでいいらしい。

}



function playGoogleHome(url: string) {
    // google-home-notifierはなんかNode.JSのバージョンがなんとかで動かなかったのでこっちで。
    // 音楽再生だけなのでこっちでも良き
    // 参考：https://ebisu-voice-production.com/blogs/play-mp3-file-locally/
    const { Client, DefaultMediaReceiver } = require('castv2-client');
    const host = process.env.HOST || '192.168.1.36';
    const client = new Client();
    client.connect(host, () => {
        client.launch(DefaultMediaReceiver, (err: any, player: any) => {
            const media = {
                contentId: url,
                contentType: 'audio/mp3',
                streamType: 'BUFFERED',
            };
            player.load(media, { autoplay: true }, (err: any, status: any) => {
                console.log(err, status);
                client.close();
            });
        });
    });
}