# teamwork-log

Take a CSV file and log its data as time entries in TeamWork.

# Configuration
### Create the config file

- Duplicate `example.log.config.json` and rename to `log.config.json`
- Edit `log.config.json`

### Add company/user info

- Add your company id into the `company` field, which is the subdomain of your Teamwork URL
    - If your Teamwork url is `http://acme.teamworkpm.net/` then your company id is `acme`
- Log into Teamwork and get your "API Authentication Token" found within your account details section
    - Enter this value into the `key` field
- To get your Teamwork user id, hover over your user photo/picture
    - Look at your browser status bar
    - The numeric value in the URL is your user id
    - Enter this value into the `personId` field

### Map CSV fields

- Alter the capitalized values `Date`, `Notes`, etc to the names of the columns in your CSV file

### Map projects

- A project mapping consists of the project's name from your time keeping application (TKA hereafter), and the id of the associated project in Teamwork
    - Get the project id by navigating to the project in Teamwork
    - The project id is the numerical value in the URL

### Map project tasks (optional)

- You can map a task from your TKA to a task in Teamwork
- Follow the example syntax in `example.log.config.json` 
- The Teamwork task id can be found similar to how you find a project's id

# Usage

- Export a CSV file from your TKA
- In your terminal, `$ log --file path/to/your/csvfile.csv`

# Troubleshooting

- If you get an error like `log: too many arguments`, then try running as `$ ./log --file ...` instead
