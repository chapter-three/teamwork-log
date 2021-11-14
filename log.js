#! /usr/bin/env node

import { existsSync } from 'fs';
import path from 'path'
import { Command } from 'commander';
import { parseFile } from '@fast-csv/parse';
import { getConfig, validateData, parseData, logTime } from './lib/tw-log.js';

// Load configuration data.
const __dirname = path.resolve();
getConfig(__dirname + '/log.config.json');

/*
 * Parse a CSV timesheet.
 */
const program = new Command();
program
  .option('-f, --file <path>', 'The full path and filename to the CSV export.')
  .option('-s, --simulate', 'Simulate logging time.');

// Help suggestions.
const helpText = `
Example:
  $ ./log --file 20210919-20210925.csv
`;
program.addHelpText('after', helpText);
program.showSuggestionAfterError();

// Parse command line and get options.
program.parse();
const options = program.opts();
const file = options.file;

// Output help if no arguments were supplied.
if (!file) {
  program.help();
}

// Check if csv file exists.
if (!existsSync(file)) {
  console.error('Could not find %s.', file);
  process.exit(1001);
}

// Check if we're running in simulated mode.
if (options.simulate) {
  console.log('Running in simulated mode.');
  console.log();
}

// Prepare time entries.
let timeEntries = {};

// Parse CSV file.
console.log('Parsing file %s...', file);
parseFile(file, { headers: true })
  .validate((data) => validateData(data))
  .on('error', (error) => console.error(error))
  .on('data', (row) => parseData(row, timeEntries))
  .on('end', (rowCount) => {
    console.log(`Parsed ${rowCount} rows.`);
    console.log();
    logTime(timeEntries, options.simulate);
  });
