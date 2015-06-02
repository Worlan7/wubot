// Description:
//   wubot script to display comments put on kanbanize cards
//
// Dependencies:
//   xmlhttprequest
//
// Configuration:
//   None
//
// Commands:
//	 wubot any new comments ? - returns any new comments on kanbanize cards
//   hubot is it weekend ?  - returns whether is it weekend or not
//   hubot is it holiday ?  - returns whether is it holiday or not
 

module.exports = function(robot) {

    var kanEnum = {
        API_KEY : 'JJ5kg0O7zmuJLMQbmKYNdsZtzHOZA4tKYTTbTfX2',
        BASE_URL : 'kanbanize.com/index.php/api/kanbanize',
        BASE_DOMAIN : 'wustlpa',
    }

    var KanbanizeJS = function(options) {
        var domain;
        if (null != options.email && null != options.password){
            this.email = options.email;
            this.password = options.password;
        }

        this.apikey = null != options.apikey ? options.apikey : kanEnum.API_KEY;
        domain = null != options.domain ? options.domain + '.' : kanEnum.BASE_DOMAIN + '.';
        this.kanbanize_url = "http://" + domain + kanEnum.BASE_URL;
    }

    KanbanizeJS.prototype._getUrl = function(call) {
        var key, url, val, _ref;
        url = [this.kanbanize_url, call["function"]];
        _ref = call.data;
        for (key in _ref) {
        val = _ref[key];
        url.push(key, encodeURIComponent(val));
        }
        return url.join('/');
    };

    KanbanizeJS.prototype.call = function(apiCall, msg) {
        var l, url, xmlhttp, response;
        if (apiCall["function"] !== 'login' && (this.apikey == null)) {
        l = this.login();
        this.apikey = l.apikey;
        }
        url = this._getUrl(apiCall);
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        xmlhttp = new XMLHttpRequest();

        //console.log(this.apikey)
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState === 4) {
                if (xmlhttp.status === 200) {
                    //console.log('good');
                    //console.log(xmlhttp.responseText);
                    response = JSON.parse(xmlhttp.responseText);
                    var jString = JSON.stringify(response);
                    return msg.reply(jString);
                } else {
                    return console.log('something else other than 200 was returned');
                }
            }
        };

        xmlhttp.open("POST", url, true);
        xmlhttp.setRequestHeader("apikey", this.apikey);
        xmlhttp.send();        
    };

    KanbanizeJS.prototype.login = function() {
        var call;
        call = {
        "function": 'login',
        data: {
          email: this.email,
          password: this.password
        }
        };
        return this.call(call);
    };


    robot.respond(/is it (weekend|holiday)\s?\?/i, function(msg){
        var today = new Date();
        msg.reply(today.getDay() === 0 || today.getDay() === 6 ? "YES" : "NO");
    });	

    robot.hear(/whatever/i, function(msg){
        msg.reply("too sassy");
    });	
	
	robot.respond(/any new comments\s?\?/i, function(msg){

		var kanbanize = new KanbanizeJS({
            apikey : kanEnum.API_KEY,
        });

        get_task_details = {
            "function": 'get_task_details',
            data:{
                boardid : '9',
                taskid : '1355',
                history : 'yes',
                event : 'comment',
                format : 'json',
            }
        }

        kanbanize.call(get_task_details, msg)
	});


} 
