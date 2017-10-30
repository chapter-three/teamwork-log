#!/usr/bin/env node

/**
 * Node JS command that get the data directly from the Tyme2 app.
 **/

// Require libraries
const chalk       = require('chalk');
const clear       = require('clear');
const CLI         = require('clui');
const table       = require('cli-table2');
const figlet      = require('figlet');
const Spinner     = CLI.Spinner;
const tyme        = require('tyme2');
const program     = require('commander');
const moment      = require('moment');
const inquirer    = require('inquirer');

/**
 * Defines the command callback for this file.
 */
const main = () => {
  clear();
  console.log(
    chalk.yellow(
      figlet.textSync('TW Log', { horizontalLayout: 'full' })
    )
  );

  // Start the Spinner.
  let spinner = new Spinner('Retrieving time records...  ', ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷']);
  spinner.start();

  // Function to convert seconds to duration in a time format (1:00 for 1 hour).
  let durationFromSeconds = s => Math.floor(s/3600) + ":" + ("0" + ((s - (Math.floor(s/3600)*3600))/60)).slice(-2);

  tyme
    .projects()
    .then(projects => {
      tyme
        .tasks()
        .then(tasks => {
          tyme
            .getTaskRecords()
            .then(taskRecords => {
              spinner.stop();

              let records = taskRecords.map(r => { return {
                "date":     moment(r.timestart).format("MM/DD/YYYY"),
                "project":  projects.find(p => p.id == r.relatedprojectid).name,
                "task":     tasks.find(t => t.id == r.relatedtaskid).name,
                "hours":    (r.timedduration/3600).toFixed(2),
                "time":     durationFromSeconds(r.timedduration),
                "note":     r.note
              };});

              let time_log_table = new table({
                head: ['Date', "Project", "Task", "Duration", 'Notes'], colWidths: [20, 20],
                chars: {'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''}
              });
              // Add the records to the table.
              time_log_table.push.apply(time_log_table, records.map(r => [
                r.date,
                r.project,
                r.task,
                r.time + " (" + r.hours + ")",
                r.note
              ]));

              console.log(chalk.green("Hours last week."));
              console.log(time_log_table.toString());

              // Prompt for confirmation.
              inquirer.prompt({
                name: 'confirmation',
                type: 'confirm',
                message: 'Confirm to import into Teamwork?',
                default: false
              }).then(response => {
                if (response.confirmation) {
                  // Replace with function to log the time.
                  console.log("Confirmed");
                } else {
                  console.log("Operation aborted");
                }
              });
            });
        });
    });
};

program
  .version('0.1.0')
  .option('-s, --start-date <date>', 'Do not log items before this date.')
  .option('-s, --end-date <date>', 'Do not log items after this date.')
  .option('-y, --yes', 'Bypass log confirmation.')
  // .command('log [log]', 'Logs time to TW given a csv file.')
  // .command('list-projects', 'Lists all projects')
  .parse(process.argv);

main();
