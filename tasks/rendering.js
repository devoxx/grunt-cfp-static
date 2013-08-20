/*
 * grunt-cfp-static
 * https://github.com/devoxx/grunt-cfp-static
 *
 * Copyright (c) 2013 Jo Voordeckers
 * Licensed under the MIT license.
 */

'use strict';

module.exports.renderEvent = function(grunt, files, output, event) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  var Handlebars = require('handlebars'),
      _ = grunt.util._,
      http = require('client-http'),
      q = require('q'),
      moment = require('moment'),

      // Placeholders for optional MOCK JSON data
      eventJSON,
      tracksJSON,
      presentationsJSON,
      schedulesJSON,
      speakersJSON,
      
      // Uncomment to skip remote REST calls using DV12 data
      // eventJSON = require('./event.json'),
      // tracksJSON = require('./tracks.json'),
      // presentationsJSON = require('./presentations.json'),
      // schedulesJSON = require('./schedule.json') ,
      // speakersJSON = require('./speakers.json'), 

      eventUrl = event.url + '/events/' + event.id,
      schedulesUrl = event.url + '/events/' + event.id + '/schedule',
      tracksUrl = event.url + '/events/' + event.id + '/tracks',
      speakersUrl = event.url + '/events/' + event.id + '/speakers',
      presentationsUrl = event.url + '/events/' + event.id + '/presentations'
      ;

    var _defer = q.defer();

    function getMockdataOrCallREST(mockData, url) {
        var defer = q.defer();
        if (typeof(mockData) !== 'undefined') {
            defer.resolve(mockData);
        } else {
            http.get(url, function(data) {
                defer.resolve(JSON.parse(data));
            });    
        }
        return defer.promise;
    }

    function getEvent(){        
        return getMockdataOrCallREST(eventJSON, eventUrl);
    }

    function getSchedules(){
        return getMockdataOrCallREST(schedulesJSON, schedulesUrl);   
    }

    function getTracks(){
        return getMockdataOrCallREST(tracksJSON, tracksUrl);
    }

    function getSpeakers(){
        return getMockdataOrCallREST(speakersJSON, speakersUrl);
    }

    function getPresentations(){
        return getMockdataOrCallREST(presentationsJSON, presentationsUrl);
    }

    function toUrl(name) {
        var cleaned = name.toLowerCase() // change everything to lowercase
            .replace(/^\s+|\s+$/g, "") // trim leading and trailing spaces     
            .replace(/[_|\s]+/g, "-") // change all spaces and underscores to a hyphen
            .replace(/[^a-z0-9-]+/g, "") // remove all non-alphanumeric characters except the hyphen
            .replace(/[-]+/g, "-") // replace multiple instances of the hyphen with a single instance
            .replace(/^-+|-+$/g, ""); // trim leading and trailing hyphens
        return event.key + "-" + cleaned + ".html";
    }

    /**
     * Enhance JSON returned by the CFP
     */
    function prepareData(eventDetails, schedules, tracks, speakers, presentations) {

        console.log("Preparing JSON data for rendering.");

        function trackSpeaker(speakerId, trackIdVar, day) {

            var speaker = _.find(speakers, function(speaker) { return speaker.id == speakerId} );

            if (!speaker) {
                console.error("Missing speaker for presentation speaker mapping", speakerId);
                return;
            }

            // for isotope
            speaker.tracks = speaker.tracks || [];
            speaker.tracks.push(trackIdVar);
            speaker.tracks = _.uniq(speaker.tracks);
            speaker.days = speaker.days || [];
            speaker.days.push(day);
            speaker.days = _.uniq(speaker.days);
        }

        function getTrack(trackname) {
            var track = _.find(tracks, function(track){ return track.name == trackname; });
            return track ? track : "missingTrack";
        }

        function toUrl(name) {
            var cleaned = name.toLowerCase() // change everything to lowercase
                .replace(/^\s+|\s+$/g, "") // trim leading and trailing spaces     
                .replace(/[_|\s]+/g, "-") // change all spaces and underscores to a hyphen
                .replace(/[^a-z0-9-]+/g, "") // remove all non-alphanumeric characters except the hyphen
                .replace(/[-]+/g, "-") // replace multiple instances of the hyphen with a single instance
                .replace(/^-+|-+$/g, ""); // trim leading and trailing hyphens
            return event.key + "-" + cleaned + ".html";
        }

        _.each(speakers, function(speaker){            
            speaker.page = toUrl(speaker.firstName + " " + speaker.lastName);          
        });

        _.each(tracks, function(track){
            track.icon = event.trackMapping[new String(track.id)];
        });

        _.each(presentations, function(pres){            

            var track = getTrack(pres.track);

            if (track) {
                pres.trackIcon = event.trackMapping[new String(track.id)];
                pres.trackDescription = track.description;
            }

            var trackIdVar = "track-" + track.id;

            var schedule = _.find(schedules, function(schedule){ return schedule.presentationId == pres.id; });

            var dayIdVar = "day-";

            if (schedule) {
                dayIdVar += moment(schedule.fromTime).day();
            } else {
                dayIdVar += "missingSchedule";
                console.log("Missing schedule for pres", pres.id);
            }            

            // for isotope
            pres.dayIdVar = dayIdVar;
            pres.trackIdVar = trackIdVar;

            // for rendering
            pres.schedule = schedule;        

            _.each(pres.speakers, function(speaker) { // Add tracks and days to speaker
                trackSpeaker(speaker.speakerId, trackIdVar, dayIdVar);
            });

        });

        _.each(presentations, function(pres){ // Augment presentations with full speakers

            var newSpeakers = [];

            _.each(pres.speakers, function(presSpeaker) {

                var fullSpeaker = _.find(speakers, function(speaker){ return speaker.id == presSpeaker.speakerId});

                if (!fullSpeaker) {
                    console.error("Missing full speaker for pres ", pres.id, "speaker", presSpeaker);
                    return;
                }

                newSpeakers.push(fullSpeaker);

            });

            pres.speakers = newSpeakers; // Strip the missing ones

            var speaker = pres.speakers[0];

            if (!speaker) {
                console.error("Missing speaker presId", pres.id, "speaker", pres.speaker);
                return;
            }

            delete pres.speaker;
            pres.page = toUrl(speaker.page) + "?presId=" + pres.id;

        });

        _.each(speakers, function(speaker){

            if (speaker.imageURI === "http://www.devoxx.be/img/thumbnail.gif") {
                speaker.imageURI = "/images_dummy/no_avatar.gif";
            }

            var newPrezos = [];

            _.each(speaker.talks, function(speakerPres){

                var fullPres = _.find(presentations, function(pres){ return pres.id == speakerPres.presentationId; })

                if (!fullPres) {
                    console.error("Missing full presentation for speakermapping", speakerPres);
                    return;
                }

                newPrezos.push(fullPres);

            });

            newPrezos = _.sortBy(newPrezos, function(prezo){ return prezo.schedule ? prezo.schedule.fromTime : ""; });

            speaker.talks = newPrezos;

        });

        presentations = _.sortBy(presentations, function(pres){ return pres.schedule ? pres.schedule.fromTime : ""; });

        var fullSchedule = _.groupBy(presentations, "dayIdVar");

        return {
            eventDetails: eventDetails,
            schedules: schedules, 
            tracks: tracks, 
            speakers: speakers, 
            presentations: presentations,
            fullSchedule: fullSchedule            
        }

    }

    function renderData(eventDetails, schedules, tracks, speakers, presentations) {

        console.log("Prepare template engine...");

        var defer = q.defer();

        var srcFile = grunt.file.read(files + '/index.hbr.html');

        var partialSpeakers = grunt.file.read(files + '/speakersBody.hbr.html');
        var partialSpeaker = grunt.file.read(files + '/speakerBody.hbr.html');
        var partialSpeakerRow = grunt.file.read(files + '/speakerRow.hbr.html');
        var partialSchedule = grunt.file.read(files + '/scheduleBody.hbr.html');

        var template = Handlebars.compile(srcFile);

        Handlebars.registerPartial("speakersBody", partialSpeakers);
        Handlebars.registerPartial("speakerBody", partialSpeaker);
        Handlebars.registerPartial("speakerRow", partialSpeakerRow);
        Handlebars.registerPartial("scheduleBody", partialSchedule);
        Handlebars.registerHelper("nlbr", function(text) {
            text = Handlebars.Utils.escapeExpression(text);
            text = text.toString();
            text = text.replace(/(\r\n|\n|\r)/gm, '<br>');
            return new Handlebars.SafeString(text);
        });
        // Workaround ../ not working in regular partials
        Handlebars.registerHelper('include', function(templatename, options){  
            var partial = Handlebars.partials[templatename];
            if (typeof partial === "string") {
                partial = Handlebars.compile(partial);
                Handlebars.partials[templatename] = partial;
            }
            var context = _.extend({}, this, options.hash);
            return new Handlebars.SafeString(partial(context));
        });

        Handlebars.Utils.log = function(log) {
            console.log("HBR:", log);
        }
        Handlebars.registerHelper("log", Handlebars.Utils.log)

        Handlebars.registerHelper("schedule", function(schedule) {
            
            var fromTime = moment(schedule.fromTime);
            var toTime = moment(schedule.toTime);
            return new Handlebars.SafeString(fromTime.format("ddd") + " " + fromTime.format("HH:mm") + " - " + toTime.format("HH:mm"));
        });

        Handlebars.registerHelper('first', function(context, options) {
          return options.fn(context[0]);
        });

        Handlebars.registerHelper('ifequal', function (val1, val2, options) {
            if (val1 === val2) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        });

        var prepared = prepareData(eventDetails, schedules, tracks, speakers, presentations);

        try {

            console.log("Rendering HTML...");

            var allSpeakers = function () {

                // /dv13-speakers.html

                var destFile = output + '/' + toUrl("speakers");
   
                var data = { 
                    isSpeakers: true,                
                    hasSchedules: prepared.schedules && prepared.schedules.length > 0,
                    eventDetails: prepared.eventDetails,
                    tracks: prepared.tracks,
                    speakers: prepared.speakers
                };

                var html = template(data);

                grunt.file.write(destFile, html);

            }

            var eachSpeaker = function () {

                // /dv13-romain-guy.html?presId=123 < link to a pres within a speaker page

                _.each(prepared.speakers, function(speaker){

                    var destFile = output + '/' + speaker.page;
       
                    var data = { 
                        isSpeaker: true,                
                        speaker: speaker
                    };

                    var html = template(data);

                    grunt.file.write(destFile, html);

                });

            } 

            var allPresentations = function() {

                // /dv13-schedule.html

                var destFile = output + '/' + toUrl("schedule");
   
                var data = { 
                    isSchedule: true,                
                    eventDetails: prepared.eventDetails,
                    tracks: prepared.tracks,
                    fullSchedule: prepared.fullSchedule
                };

                var html = template(data);

                grunt.file.write(destFile, html);

            }          

            allSpeakers();
            eachSpeaker();
            allPresentations();
              

            console.log("Done.");
                
        } catch(e) {        
            defer.reject(e);
        }

        defer.resolve();



        return defer.promise;
    }

    console.log("Rendering event ID/Key:", event.id, event.key, "fetching JSON data...");

    q.all([getEvent(), getSchedules(), getTracks(), getSpeakers(), getPresentations()])
        .spread(renderData)
        .then(function(){ console.log("Rendering done:", event.id); })
        .then(_defer.resolve)
        .fail(_defer.reject);

    return _defer.promise;

};