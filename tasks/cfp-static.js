/*
 * grunt-cfp-static
 * https://github.com/jayv/grunt-cfp-static
 *
 * Copyright (c) 2013 Jo Voordeckers
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  var _ = grunt.util._,
      renderEvent = require('./rendering').renderEvent,
      q = require('q');

  grunt.registerMultiTask('cfpstatic', 'Build static Devoxx website.', function() {
    
    // Merge task-specific and/or target-specific options with these defaults.
    var done = this.async();

    var files = this.data.files;

    var output = this.data.output;

    var promise = q();

    _.each(this.data.events, function(event){
      var eventPromise = function() {
        return renderEvent(grunt, files, output, event);      
      }
      promise = promise.then(eventPromise);       
    });
    
    promise = promise.fail(function(e){ 
      console.error("Failed to render: ", e);
      done(false);
    });

    promise = promise.then(done);
    
  });

};