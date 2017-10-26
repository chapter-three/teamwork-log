--------------------------------------------------------------------------------
-- This script uses Tyme2's AppleScript API to export yesterday's data,
-- then uses Bala's log script to push that data to Teamwork.
--
-- This file needs to be in the same directory as Bala's log script.
--
-- To use (from the command line):
--    $ osascript tyme2-log-yesterday.applescript
--------------------------------------------------------------------------------


global _filename

on run
  tell application "Finder"
    -- Get this script's parent directory
    set _path to (container of (path to me)) as text
    set _filename to _path & "tyme2-log-yesterday.csv"
    -- Convert the filename to "/path/to/file" format
    set _filename to POSIX path of _filename
  end tell

  -- Delete the csv file (if it exists) and create empty csv
  do shell script "rm -f " & _filename
  do shell script "touch " & _filename

  set _date to current date
  set _time to time of _date
  -- Start date is today at 12am
  set _startDate to _date - _time - (1 * days)
  -- End date is today at 11:59:59pm
  set _endDate to _startDate + (1 * days) - 1

  -- Create the header row
  set _headerFields to {"Date", "Project", "Task", "Duration", "Notes"}
  set _headerLine to my lineFromFields(_headerFields)
  my writeLine(_headerLine)

  tell application "Tyme2"
    GetTaskRecordIDs startDate (_startDate) endDate (_endDate)
    set _fetchedRecords to fetchedTaskRecordIDs as list
    repeat with _recordID in _fetchedRecords
      -- Parse each Tyme record, and write it as a new line in the csv
      set _line to my lineFromFields(my fieldsFromRecord(_recordID))
      set _output to my writeLine(_line)
      _output
    end repeat
  end tell

  -- Send this newly created csv to the awesome Teamwork logger that Bala wrote
  set UnixPath to POSIX path of ((path to me as text) & "::")
  set _results to (do shell script {"cd " & UnixPath & "&& ./log -f tyme2-log-yesterday.csv"})
  my printResults(_results)
end run

on printResults(_results)
  set AppleScript's text item delimiters to ASCII character 10
  set _results to paragraphs of _results
  set _output to "" as text
  repeat with _result in _results
    set _output to _output & _result & linefeed
  end repeat
  return _output
end printResults

on writeLine(_line)
  my writeToFile(_line, _filename, true)
end writeLine

on lineFromFields(_fields)
  set _quotedFields to {}
  repeat with _field in _fields
    copy my quoteCSV(_field) to end of _quotedFields
  end repeat
  set lf to ASCII character 10
  return my join(_quotedFields, ",") & lf
end lineFromFields

on fieldsFromRecord(_recordID)
  set _fields to {}
  tell application "Tyme2"
    GetRecordWithID _recordID
    set _timeStart to timeStart of lastFetchedTaskRecord
    copy my getDate(_timeStart) to end of _fields
    set _projectId to relatedProjectID of lastFetchedTaskRecord
    copy my getProject(_projectId) to end of _fields
    set _taskId to relatedTaskID of lastFetchedTaskRecord
    copy my getTask(_taskId) to end of _fields
    set _timedDuration to timedDuration of lastFetchedTaskRecord
    copy my getDuration(_timedDuration) to end of _fields
    set _note to note of lastFetchedTaskRecord
    copy _note to end of _fields
  end tell
  return _fields
end fieldsFromRecord

-- Get duration in "hours:minutes", ex "1:20"
on getDuration(_duration)
  -- _duration is in seconds
  set _hours to my floor(_duration / 60 / 60)
  set _minutes to round(((_duration / 60 / 60) - _hours) * 60)
  return my numToStr(_hours) & ":" & my numToStr(_minutes)
end getDuration

-- Get date in "m/d/yyyy", ex "1/15/2016"
on getDate(_dateObj)
  set _year to year of _dateObj
  set _month to month of _dateObj as integer
  set _day to day of _dateObj
  return my numToStr(_month) & "/" & my numToStr(_day) & "/" & numToStr(_year)
end getDate

-- Get project's name
on getProject(_projectId)
  tell application "Tyme2"
    set _project to the first item of (every project whose id = _projectId)
    return name of _project
  end tell
end getProject

-- Get task's name
on getTask(_taskId)
  tell application "Tyme2"
    set _task to the first item of (every task of every project whose id = _taskId)
    return name of _task
  end tell
end getTask

on quoteCSV(_string)
  set dq to "\""
  return dq & my replace(_string, dq, dq & dq) & dq
end quoteCSV

on replace(_string, _source, _replacement)
  set AppleScript's text item delimiters to _source
  set _items to every text item of _string
  set AppleScript's text item delimiters to _replacement
  return _items as Unicode text
end replace

on join(_list, _sep)
  set _temp to AppleScript's text item delimiters
  set AppleScript's text item delimiters to _sep
  set _result to _list as string
  set AppleScript's text item delimiters to _temp
  return _result
end join

on numToStr(this_number)
  set this_number to this_number as string
  if this_number contains "E+" then
    set x to the offset of "." in this_number
    set y to the offset of "+" in this_number
    set z to the offset of "E" in this_number
    set the decimal_adjust to characters (y - (length of this_number)) thru -1 of this_number as string as number
    if x is not 0 then
      set the first_part to characters 1 thru (x - 1) of this_number as string
    else
      set the first_part to ""
    end if
    set the second_part to characters (x + 1) thru (z - 1) of this_number as string
    set the converted_number to the first_part
    repeat with i from 1 to the decimal_adjust
      try
        set the converted_number to the converted_number & character i of the second_part
      on error
        set the converted_number to the converted_number & "0"
      end try
    end repeat
    return the converted_number
  else
    return this_number
  end if
end numToStr

on floor(x)
  local x
  try
    return round (x) rounding down
  on error eMsg number eNum
    error "Can't floor(x): " & eMsg number eNum
  end try
end floor

on writeToFile(this_data, target_file, append_data) -- (string, file path as string, boolean)
  try
    --set the target_file to the target_file as text
    set the open_target_file to open for access target_file with write permission
    if append_data is false then set eof of the open_target_file to 0
    write this_data to the open_target_file starting at eof
    close access the open_target_file
    return true
  on error
    try
      close access file target_file
    end try
    return false
  end try
end writeToFile
