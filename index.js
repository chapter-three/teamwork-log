#! /usr/local/bin/node

/**
 * Node JS command that get the data directly from the Tyme2 app.
 **/

// Require libraries
const chalk       = require('chalk');
const clear       = require('clear');
const CLI         = require('clui');
const figlet      = require('figlet');
const Spinner     = CLI.Spinner;
const tyme        = require('tyme2');
const program     = require('commander');

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
  let spinner = new Spinner('Processing...  ', ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷']);
  spinner.start();

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

              console.log('Projects: ', projects.map(x => x.name), "\n");
              console.log('Tasks: ', tasks.map(x => x.name), "\n");
              console.log('Task Records: ', taskRecords.map(x => x.note), "\n");
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
