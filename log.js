#! /usr/bin/env node

const Log = require('./lib/tw-log')

// Load configuration data.
const config = Log.getConfig(__dirname + '/log.config.json');

/*
 * Parse a CSV timesheet from Tyme.
 */

// Parse command line arguments.
var program = require('commander');
program
  .version('0.0.1')
  .option('-f, --file <path>', 'The full path and filename to the CSV export.')
  .option('-s, --simulate', 'Simulate logging time.')
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('    $ log --file 20150511-20150517.csv');
    console.log();
  })
  .parse(process.argv);

// Output help if no arguments were supplied.
if (program.rawArgs.length <= 2) {
  program.help();
}

// Check if we're running in simulated mode.
if (program.simulate) {
  console.log('Running in simulated mode.');
  console.log();
}


// Prepare time entries.
var timeEntries = {};

// Parse CSV file.
var file = program.file;
console.log('Parsing file %s...', file);

var csv = require('fast-csv');
csv
  .fromPath(file, {headers : true})
  .validate(Log.validateData)
  .on('data', function(data) {
    Log.parseData(data, timeEntries);
  })
  .on('end', function() {
    console.log('Parsing completed.');
    console.log();

    Log.logTime(timeEntries, program.simulate);
  })
  .on('error', function(error) {
    // @todo This doesn't get triggered on file open errors.
    console.error('Could not read from file %s.', file);
    console.error(error.message);
    console.log();
    process.exit(1004);
  });