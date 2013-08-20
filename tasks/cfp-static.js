/*
 * grunt-cfp-static
 * https://github.com/devoxx/grunt-cfp-static
 *
 * Copyright (c) 2013 Jo Voordeckers
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  var _ = grunt.util._,
      Handlebars = require('handlebars'),
      renderEvent = require('./rendering').renderEvent,
      q = require('q');

  grunt.registerMultiTask('cfpstatic', 'Build static Devoxx website.', function() {
    
    // Merge task-specific and/or target-specific options with these defaults.
    var done = this.async();

    var files = this.data.files;

    var output = this.data.output;

    var promise = q();

    // Render general static pages
    var srcFile = grunt.file.read(files + '/index.hbr.html');
    var template = Handlebars.compile(srcFile);

    var partialAgreement = grunt.file.read(files + '/agreementBody.hbr.html');
    var partialThankyou = grunt.file.read(files + '/thankyouBody.hbr.html');
    Handlebars.registerPartial("agreementBody", partialAgreement);
    Handlebars.registerPartial("thankyouBody", partialThankyou);

    function renderStatic(filename, data) {

      var destFile = output + '/' + filename;
      var html = template(data);
      grunt.file.write(destFile, html);
    }

    renderStatic("agreement.html", { isAgreement: true } );
    renderStatic("thankyou.html", { isThankyou: true } );

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