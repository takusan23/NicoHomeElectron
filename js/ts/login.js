var remote = require('electron').remote;
function login() {
    var mail = document.getElementById('login_mail_input');
    var pass = document.getElementById('login_pass_input');
    //ログインする。
    var request = require('request');
    // APIを叩く？
    var url = 'https://secure.nicovideo.jp/secure/login?site=niconico';
    //送るデータ
    var sendData = "mail_tel=" + mail.value + "&password=" + pass.value;
    //ヘッダー
    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    //オプション
    var options = {
        url: url,
        method: 'POST',
        headers: headers,
        form: sendData
    };
    //送信
    request(options, function (error, response, body) {
        //レスポンスヘッダーからset-cookieを取り出す
        var setCookie = response.headers['set-cookie'];
        console.log(setCookie);
        //user_sessionは[2]なので
        var user_session = setCookie[2];
        user_session = user_session.replace('user_session=', ''); //切り取って  
        user_session = user_session.substring(0, 86); //user_sessionは長さ86らしい。
        //保存
        localStorage.setItem('mail', mail.value);
        localStorage.setItem('pass', pass.value);
        localStorage.setItem('user_session', user_session);
        //閉じる。
        remote.getCurrentWindow().close();
    });
}
window.onload = function () {
    //メアド・パスワードが保存されていれば表示させる
    if (localStorage.getItem('mail') !== null) {
        var mail = document.getElementById('login_mail_input');
        var pass = document.getElementById('login_pass_input');
        mail.value = localStorage.getItem('mail');
        pass.value = localStorage.getItem('pass');
    }
};
//# sourceMappingURL=login.js.map