/**
 * @file TW Log main library.
 */

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

module.exports = {
  config: {},
  /**
   * Gets the config object.
   * @returns {*}
   */
  getConfig: (configfile = '')  => {
    const nconf = require('nconf');
    nconf
      .use('file', { file: configfile })
      .load();

    if (!Object.keys(nconf.get()).length) {
      console.error('Could not read from file %s.', logfile);
      console.log();
      process.exit(1001);
    }

    this.config = nconf.get();
    let project;

    // Allow simple format in config, but convert to full format before use.
    for (project in this.config.map.project) {
      if (!(this.config.map.project[project] instanceof Object)) {
        this.config.map.project[project] = {
          'id': this.config.map.project[project],
          'task': {}
        }
      }
    }
    return this.config;
  },
  /**
   * Validates data from CSV.
   *
   * @param data
   * @returns {boolean}
   */
  validateData: data => {
    // Ensure all fields exist.
    let hasError = false;
    let columns = ['date', 'notes', 'project', 'time'];

    for (let i = 0, tot = columns.length; i < tot; i++) {
      let column = columns[i];
      if (data[this.config.map.csv[column]] === undefined) {
        console.error('Column %s (%s) does not exist in the CSV file.', this.config.map.csv[column], column);
        hasError = true;
      }
    }
    if (hasError) {
      process.exit(1002);
    }

    if (this.config.map.project[data[this.config.map.csv.project]] === undefined) {
      console.error('No project ID was found for "%s". Add it to your log.config.json file.', data[this.config.map.csv.project]);
      process.exit(1003);
    }

    return true;
  },
  /**
   * Parses data from CSV.
   *
   * @param data
   * @param timeEntries
   */
  parseData: (data, timeEntries) => {
    let date = new Date(data[this.config.map.csv.date]).format();
    let notes = data[this.config.map.csv.notes];
    let project = data[this.config.map.csv.project];
    let task = data[this.config.map.csv.task];
    let time = data[this.config.map.csv.time].split(':');

    let description = '';
    if (task) {
      if (notes) description = task + ': ' + notes;
      else description = task;
    }
    else if (notes) description = notes;

    let configProject = this.config.map.project[project];

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
          'description': description,
          'person-id': this.config.personId,
          'date': date,
          // 'time': '10:10',
          'hours': +parseInt(time[0]),
          'minutes': +parseInt(time[1]),
          'isbillable': true
        },
        data: {
          project: project,
          projectId: configProject.id,
          task: task,
          taskId: configProject.task[task] ? configProject.task[task] : null
        }
      }
    }
    else {
      // Update hours & minutes only.
      timeEntries[project][description][date].json.hours += parseInt(time[0]);
      timeEntries[project][description][date].json.minutes += parseInt(time[1]);

      // Split minutes into hours and minutes.
      let minutes = timeEntries[project][description][date].json.minutes;
      if (minutes >= 60) {
        let hours = Math.floor(minutes / 60);
        minutes = minutes % 60;

        timeEntries[project][description][date].json.hours += hours;
        timeEntries[project][description][date].json.minutes = minutes;
      }
    }
  },
  /**
   * Logs time entries.
   *
   * @param timeEntries
   * @param {bool} simulate
   */
  logTime: (timeEntries, simulate = false)=> {
    console.log('Logging time...');

    // Talk to teamwork API.
    let request = require('request');
    let isNumeric = require("isnumeric");

    let base64 = new Buffer(this.config.key + ':xxx').toString('base64');

    let host = 'https://' + this.config.company + '.teamworkpm.net';
    let pathProject = '/projects/{project-id}/time_entries.json';
    let pathTask = '/tasks/{task-id}/time_entries.json';

    let options = {
      method: 'POST',
      encoding: 'utf8',
      followRedirect: true,
      headers: {
        'Authorization': 'BASIC ' + base64,
        'Content-Type': 'application/json'
      }
    };

    let projectId,
      description,
      date,
      descriptionArray;

    for (projectId in timeEntries)  {
      for (description in timeEntries[projectId])  {
        for (date in timeEntries[projectId][description])  {
          let timeEntry = timeEntries[projectId][description][date];

          if (timeEntry.data.taskId === null) {
            // See if the task description includes a taskId.
            descriptionArray = description.split(' - ');
            if (descriptionArray.length > 1 && isNumeric(descriptionArray[0].trim())) {
              // A teamwork task is associated with this time entry.
              options.uri = host + pathTask.replace('{task-id}', descriptionArray[0].trim());
              timeEntry.json.description = descriptionArray[1].trim();
            }
            else if (description.toUpperCase().substr(0, 4) == '[TW:') {
              // A teamwork task is associated with this time entry.
              // ID could be 6-8 characters so strip any non numeric characters.
              let tw_task_id =  description.substr(4, 9).replace(/\D/g,'');
              options.uri = host + pathTask.replace('{task-id}', tw_task_id);
              timeEntry.json.description = description.substr(12).trim();
            }
            else {
              // No teamwork task associated with this time entry.
              options.uri = host + pathProject.replace('{project-id}', timeEntry.data.projectId);
            }
          }
          else {
            // A teamwork task is associated with this time entry.
            options.uri = host + pathTask.replace('{task-id}', timeEntry.data.taskId);
          }
          options.json = {
            'time-entry': timeEntry.json
          };

          console.log('Logging %s:%s hrs for project %s, description: "%s".', timeEntry.json.hours, (timeEntry.json.minutes < 10 ? '0' : '') + timeEntry.json.minutes, timeEntry.data.project, timeEntry.json.description);

          if (!simulate) {
            request(options, function (error, response, body) {
              if (error) {
                return console.log('ERROR:', error);
              }
              else if (response.statusCode < 200 || response.statusCode > 201) {
                console.log('STATUS ERROR:', response.statusCode);
                return console.log(body);
              }
              if (response.statusCode == 200) {
                // Updated time entry.
              }
              else if (response.statusCode == 201) {
                // Created new time entry.
              }
            });
          }
        }
      }
    }
    console.log('Logging completed.');
    console.log();
  }
};
