/**
 * @file TW Log main library.
 */

import nconf from 'nconf';
import request from 'request';
import isNumeric from 'isnumeric';

/**
 * Add custom date format.
 *
 * @returns {string}
 */
Date.prototype.format = function () {
  let datestring = '';
  datestring += this.getFullYear();
  datestring += (this.getMonth() < 9 ? '0' : '') + (this.getMonth() + 1);
  datestring += (this.getDate() < 10 ? '0' : '') + this.getDate();

  return datestring;
};

let config = {};

export const getConfig = (configfile = '') => {
  nconf.use('file', { file: configfile }).load();

  if (!Object.keys(nconf.get()).length) {
    console.error('Could not read from file %s.', configfile);
    console.log();
    process.exit(1001);
  }

  config = nconf.get();
  let project;

  // Allow simple format in config, but convert to full format before use.
  for (project in config.map.project) {
    if (!(config.map.project[project] instanceof Object)) {
      config.map.project[project] = {
        id: config.map.project[project],
        task: {},
      };
    }
  }
  return config;
};

export const validateData = (data) => {
  // Ensure all fields exist.
  let hasError = false;
  let columns = ['date', 'notes', 'project', 'time'];

  for (let i = 0, tot = columns.length; i < tot; i++) {
    let column = columns[i];
    if (data[config.map.csv[column]] === undefined) {
      console.error(
        'Column %s (%s) does not exist in the CSV file.',
        config.map.csv[column],
        column
      );
      hasError = true;
    }
  }
  if (hasError) {
    process.exit(1002);
  }

  if (config.map.project[data[config.map.csv.project]] === undefined) {
    console.error(
      'No project ID was found for "%s". Add it to your log.config.json file.',
      data[config.map.csv.project]
    );
    process.exit(1003);
  }

  return true;
};

export const parseData = (row, timeEntries) => {
  let date = new Date(row[config.map.csv.date]).format();
  let notes = row[config.map.csv.notes];
  let project = row[config.map.csv.project];
  let task = row[config.map.csv.task];
  let hours = 0;
  let minutes = 0;

  if (row[config.map.csv.time].includes(':')) {
    let time = row[config.map.csv.time].split(':');
    hours = parseInt(time[0]);
    minutes = parseInt(time[1]);
  } else {
    minutes = parseInt(row[config.map.csv.time]);
  }
  if (minutes >= 60) {
    hours = Math.floor(minutes / 60);
    minutes = minutes % 60;
  }

  let description = '';
  if (task) {
    if (notes) {
      description = task + ': ' + notes;
    } else {
      description = task;
    }
  } else if (notes) {
    description = notes;
  }

  let configProject = config.map.project[project];

  if (timeEntries[project] === undefined) {
    timeEntries[project] = {};
  }
  if (timeEntries[project][description] === undefined) {
    timeEntries[project][description] = {};
  }
  if (timeEntries[project][description][date] === undefined) {
    timeEntries[project][description][date] = {
      json: {
        'project-id': configProject.id,
        description: description,
        'person-id': config.personId,
        date: date,
        hours: hours,
        minutes: minutes,
        isbillable: true,
      },
      data: {
        project: project,
        projectId: configProject.id,
        task: task,
        taskId: configProject.task[task] ? configProject.task[task] : null,
      },
    };
  } else {
    // Update hours & minutes only.
    timeEntries[project][description][date].json.hours += hours;
    timeEntries[project][description][date].json.minutes += minutes;

    let thisMinutes = timeEntries[project][description][date].json.minutes;

    if (thisMinutes >= 60) {
      const thisHours = Math.floor(thisMinutes / 60);
      thisMinutes = thisMinutes % 60;

      timeEntries[project][description][date].json.hours += thisHours;
      timeEntries[project][description][date].json.minutes = thisMinutes;
    }
  }
};

export const logTime = (timeEntries, simulate = false) => {
  console.log('Logging time...');

  // Talk to teamwork API.

  let base64 = new Buffer.from(config.key + ':xxx').toString('base64');

  let host = 'https://' + config.company + '.teamworkpm.net';
  let pathProject = '/projects/{project-id}/time_entries.json';
  let pathTask = '/tasks/{task-id}/time_entries.json';

  let options = {
    method: 'POST',
    encoding: 'utf8',
    followRedirect: true,
    headers: {
      Authorization: 'BASIC ' + base64,
      'Content-Type': 'application/json',
    },
  };

  let projectId, description, date, descriptionArray;

  for (projectId in timeEntries) {
    for (description in timeEntries[projectId]) {
      for (date in timeEntries[projectId][description]) {
        let timeEntry = timeEntries[projectId][description][date];

        if (timeEntry.data.taskId === null) {
          // See if the task description includes a taskId.
          descriptionArray = description.split(' - ');
          if (descriptionArray.length > 1 && isNumeric(descriptionArray[0].trim())) {
            // A teamwork task is associated with this time entry.
            options.uri = host + pathTask.replace('{task-id}', descriptionArray[0].trim());
            timeEntry.json.description = descriptionArray[1].trim();
          } else if (description.toUpperCase().substr(0, 4) == '[TW:') {
            // A teamwork task is associated with this time entry.
            // ID could be 6-8 characters so strip any non numeric characters.
            let tw_task_id = description.substr(4, 9).replace(/\D/g, '');
            options.uri = host + pathTask.replace('{task-id}', tw_task_id);
            timeEntry.json.description = description.substr(12).trim();
          } else {
            // No teamwork task associated with this time entry.
            options.uri = host + pathProject.replace('{project-id}', timeEntry.data.projectId);
          }
        } else {
          // A teamwork task is associated with this time entry.
          options.uri = host + pathTask.replace('{task-id}', timeEntry.data.taskId);
        }
        options.json = {
          'time-entry': timeEntry.json,
        };

        console.log(
          'Logging %s:%s hrs for project %s, description: "%s".',
          timeEntry.json.hours,
          (timeEntry.json.minutes < 10 ? '0' : '') + timeEntry.json.minutes,
          timeEntry.data.project,
          timeEntry.json.description
        );

        if (!simulate) {
          request(options, function (error, response, body) {
            if (error) {
              return console.log('ERROR:', error);
            } else if (response.statusCode < 200 || response.statusCode > 201) {
              console.log('STATUS ERROR:', response.statusCode);
              return console.log(body);
            }
            if (response.statusCode == 200) {
              // Updated time entry.
            } else if (response.statusCode == 201) {
              // Created new time entry.
            }
          });
        }
      }
    }
  }
  console.log('Logging completed.');
  console.log();
};
