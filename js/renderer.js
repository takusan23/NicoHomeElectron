"use strict";
exports.__esModule = true;
var ipcRenderer = require('electron').ipcRenderer;
//IPC通信
function showLoginWindow() {
    //ログイン画面を表示しろとメインプロセスへ送信
    ipcRenderer.send('login', 'show');
}
var heartbeatInterval = null;
var videoId = "";
//ニコニコ動画のHTML取得
function getNicoVideoHTML() {
    var request = require('request');
    if (heartbeatInterval != null) {
        clearInterval(heartbeatInterval);
    }
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
            if (json.video.dmcInfo != null) {
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
                playGoogleHome(url_1);
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
            // const modified_time = responseJSON.data.session.modified_time
            // responseJSON.data.session.modified_time = modified_time + 40000
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
var isFirst = true;
function sendHeartBeat(id, session) {
    //ハートビート（視聴継続メッセージ）送信
    //OPTIONS の方
    var xml = new XMLHttpRequest();
    xml.open("OPTIONS", "https://api.dmc.nico/api/sessions/" + id + "?_format=json&_method=PUT");
    xml.onreadystatechange = function (e) {
        isFirst = false;
        console.log(xml.status);
    };
    xml.send(); //送る内容はapi.dmc.nico/api/sessionsのjson.data.sessionでいいらしい。
    //POST の方
    var xml = new XMLHttpRequest();
    xml.open("POST", "https://api.dmc.nico/api/sessions/" + id + "?_format=json&_method=PUT");
    xml.onreadystatechange = function (e) {
        isFirst = false;
        console.log(xml.status);
    };
    xml.send(session); //送る内容はapi.dmc.nico/api/sessionsのjson.data.sessionでいいらしい。
}
function playGoogleHome(url) {
    // google-home-notifierはなんかNode.JSのバージョンがなんとかで動かなかったのでこっちで。
    // 音楽再生だけなのでこっちでも良き
    // 参考：https://ebisu-voice-production.com/blogs/play-mp3-file-locally/
    var _a = require('castv2-client'), Client = _a.Client, DefaultMediaReceiver = _a.DefaultMediaReceiver;
    var host = process.env.HOST || '192.168.1.36';
    var client = new Client();
    client.connect(host, function () {
        client.launch(DefaultMediaReceiver, function (err, player) {
            var media = {
                contentId: url,
                contentType: 'audio/mp3',
                streamType: 'LIVE'
            };
            player.load(media, { autoplay: true }, function (err, status) {
                console.log(err, status);
                client.close();
            });
        });
    });
}
//# sourceMappingURL=renderer.js.map