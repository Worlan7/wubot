// Description:
//   wubot script to display comments put on kanbanize cards in slack
//
// Dependencies:
//   node-cron
//   
//
// Configuration:
//  should set the following environment variables:
//  HUBOT_SLACK_TOKEN - for communication with Slack     
//  CRON_TIME_INTERVAL - how often hubot pings kanbanize, in milliseconds  
//  KANBANIZE_API_KEY - to link with Kanbanize.com
//  KANBANIZE_API_URL - specify Kanbanize api url, 
//      e.g. http://<subdomain>.kanbanize.com/index.php/api/kanbanize/
//  KANBANIZE_CARD_URL - specify url to link cards to
//  KANBANIZE_BOARD_ID - specify which Kanban board to check
//  TZ - Timezone used by node-cron
//
// Commands:
//   wubot any new comments ? - returns any new comments on kanbanize cards

module.exports = function(robot) {
    /*Load node-cron module to enable cron job to run*/
    var cron = require('cron');
    /*Time zone used by node-cron*/
    var tz = process.env.TZ;
    /*Map for kanbanize lane names to slack channel names*/
    var channels = {
            "TAB": "tab",
            "Bjorn": "pod-bjorn",
            "Pod Squad": "pod-squad"
    };
    /*Time constants in milliseconds*/
    var day = 1000 * 60 * 60 * 24;
    var weekendHours = 1000 * 60 * 60 * 61;
    var overnight = 1000 * 60 * 60 * 13;

    /*Simple function to format date in manner acceptable by Kanbanize API*/
    var kanbanizeDate = function(date) {
        var newDate = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" 
                    + date.getDate();
        return newDate;
    };

    /*Function to call one of the methods provided by the Kanbanize API*/
    var callKanbanize = function(apiCall, callback) {
        var command_url = process.env.KANBANIZE_API_URL + apiCall.command;
        robot.http(command_url)
            .header("apikey", process.env.KANBANIZE_API_KEY)
            .header("Accept", "application/json")
            .post(JSON.stringify(apiCall.parameters))
            (function(err, res, body) {
                try {
                    response = JSON.parse(body);
                    callback(response);
                } catch (err) {
                    console.log(err);
                }
            });
    };

    /*Function to get name of lane a comment's task is in. Used to determine
        what channel said comment should be posted in, and display it. Assumes 
        that the lane name and channel name are analogous. Can link the lane 
        name and channel name using a json file if necessary*/
    var displayToLane = function(comment) {
        var taskID = comment.taskid;
        var task_data = JSON.stringify({
            command: "get_task_details",
            parameters: {
                boardid: process.env.KANBANIZE_BOARD_ID,
                taskid: taskID,
                format: "json",
            }
        });
        var apiCall = JSON.parse(task_data);

        callKanbanize(apiCall, function(response) {
            var link = process.env.KANBANIZE_CARD_URL 
                     + process.env.KANBANIZE_BOARD_ID 
                     + "/" 
                     + comment.taskid;

            var msg = {
                message: {
                    reply_to: "general",
                    room: channels[response.lanename]
                }
            };

            var content = {
                text: '',
                fallback: comment.author + " *added a comment* on `" 
                            + comment.taskid + "`: \"" + comment.text 
                            + "\" \n\n" + link,
                pretext: comment.event + " by *" + comment.author + "*\n",
                color: response.color,
                mrkdwn_in: ["pretext", "title", "fallback", "fields"],
                fields: [{
                    title: response.title,
                    value: comment.text,
                    short: true
                }, {
                    title: "Task ID",
                    value: "<" + link + "|" + comment.taskid + ">",
                    short: true
                }]
            };

            msg.content = content;
            robot.emit('slack-attachment', msg);
        });
    };

    /*Function to get all comments made from a given time to now*/
    var getComments = function(time) {
        time = null != time? time : process.env.CRON_TIME_INTERVAL; //default
        /*How far back to query api*/
        var earliestTime = new Date(Date.now() - time);
        var from = kanbanizeDate(earliestTime);
        /*Next day; ensures all comments include current day.*/
        var end = kanbanizeDate(new Date(Date.now() + day));
        /*required parameters to retrieve comments from Kanbanize api*/
        var board_data = JSON.stringify({
            command: "get_board_activities",
            parameters: {
                boardid: process.env.KANBANIZE_BOARD_ID,
                fromdate: from,
                todate: end,
                history: "yes",
                eventtype: "Comments",
                format: "json",
            }
        });
        var apiCall = JSON.parse(board_data);

        callKanbanize(apiCall, function(response) {
            var comments = response.activities;
            /*Display any comments that were made within specified time*/
            for (var i = 0; i < comments.length; i++) {
                comment = comments[i];
                commentTime = new Date(comment.date);
                if (commentTime.getTime() >= earliestTime.getTime()) {
                    displayToLane(comment);
                }
            }
        });
    };

    /*Returns any new comments added within the given time period
        during the working week.*/
    var dailyCronJob = cron.job("*/15 06-16 * * 1-5", function() {
        console.log("Running daily cron");
        getComments(process.env.CRON_TIME_INTERVAL); 
    }, null, true, tz);
    dailyCronJob.start();

    /* */
    var overnightCronJob = cron.job("00 06 * * 2-5", function() {
        console.log("Running overnight cron");
        getComments(overnight); //from 13 hours 
    }, null, true, tz);
    overnightCronJob.start();

    /*Returns any new comments added over the weekend*/
    var weeklyCronJob = cron.job("00 06 * * 1", function() {
        console.log("Running weekly cron")
        getComments(weekendHours); //from 61 hours. (from 5pm fri - 6am mon)
    }, null, true, tz);
    weeklyCronJob.start();

    //One-off reply to any user query for any new comments
    robot.respond(/any new comments\s?\?/i, function(res) {
        getComments();
    });


}