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

      // Skip remote calls
      eventJSON = require('./event.json'),
      tracksJSON = require('./tracks.json'),
      presentationsJSON = require('./presentations.json'),
      schedulesJSON = require('./schedule.json') ,
      speakersJSON = require('./speakers.json'), 

      eventUrl = event.url + '/events/' + event.id,
      schedulesUrl = event.url + '/events/' + event.id + '/schedule',
      allTracksUrl = event.url + '/events/' + event.id + '/tracks',
      allSpeakersUrl = event.url + '/events/' + event.id + '/speakers',
      allPresentationsUrl = event.url + '/events/' + event.id + '/presentations'
      ;

    var _defer = q.defer();

    function getEvent(){
        var defer = q.defer();
        // http.get(eventUrl, defer.resolve);
        defer.resolve(eventJSON);
        return defer.promise;
    }

    function getSchedules(){
        var defer = q.defer();
        // http.get(schedulesUrl, defer.resolve);
        defer.resolve(schedulesJSON);
        return defer.promise;
    }

    function getTracks(){
        var defer = q.defer();
        // http.get(allTracksUrl, defer.resolve);
        defer.resolve(tracksJSON);
        return defer.promise;
    }

    function getSpeakers(){
        var defer = q.defer();
        // http.get(allSpeakersUrl, defer.resolve);
        defer.resolve(speakersJSON);
        return defer.promise;
    }

    function getPresentations(){
        var defer = q.defer();
        // http.get(allPresentationsUrl, defer.resolve);
        defer.resolve(presentationsJSON);
        return defer.promise;
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
                console.error("Missing speaker in speaker REST API", speakerId);
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

        function getTrackId(trackname) {
            var track = _.find(tracks, function(track){ return track.name == trackname; });
            return track ? track.id : "missingTrackId";
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

            var trackId = getTrackId(pres.track);

            if (trackId) {
                pres.trackIcon = event.trackMapping[new String(trackId)];
            }

            var trackIdVar = "track-" + trackId;

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

        presentations = _.filter(presentations, function(pres){ return pres.schedule; });

        _.each(presentations, function(pres){ // Augment presentations with full speakers

            delete pres.speaker;

            var newSpeakers = [];

            _.each(pres.speakers, function(presSpeaker) {

                var fullSpeaker = _.find(speakers, function(speaker){ return speaker.id == presSpeaker.speakerId});

                if (!fullSpeaker) {
                    console.error("Missing full speaker", presSpeaker);
                    return;
                }

                newSpeakers.push(fullSpeaker);

            });

            pres.speakers = newSpeakers; // Strip the missing ones

            var speaker = pres.speakers[0];

            if (!speaker) {
                    console.error("Missing speaker presId", pres.id);
                    return;
                }

            pres.page = toUrl(speaker.page) + "?presId=" + pres.id;

        });

        _.each(speakers, function(speaker){

            var newPrezos = [];

            _.each(speaker.talks, function(speakerPres){

                var fullPres = _.find(presentations, function(pres){ return pres.id == speakerPres.presentationId; })

                if (!fullPres) {
                    console.error("Missing full presentation", speakerPres);
                    return;
                }

                newPrezos.push(fullPres);

            });

            newPrezos = _.sortBy(newPrezos, function(prezo){ return prezo.schedule.fromTime; });

            speaker.talks = newPrezos;

        });

        presentations = _.sortBy(presentations, function(pres){ return pres.schedule.fromTime; });

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

        var prepared = prepareData(eventDetails, schedules, tracks, speakers, presentations);

        try {

            console.log("Rendering HTML...");

            var allSpeakers = function () {

                // /dv13-speakers.html

                var destFile = output + '/' + toUrl("speakers");
   
                var data = { 
                    isSpeakers: true,                
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