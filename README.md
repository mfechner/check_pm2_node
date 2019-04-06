# check_node_pm2

Nagios/Icinga Plugin to check [PM2](https://github.com/Unitech/pm2) Applications

## Installation

```npm install check_node_pm2 -g```


## Usage

### Monitor pm2 applications

```
Usage: check_node_pm2 [options]

Options:
  -A, --all                Check all processes
  -I, --ignore             Ignore process (may be repeated)
  -C, --mon_cpu            Monitor CPU usage
  -M, --mon_mem            Monitor MEM usage
  -E, --mon_err            Monitor error logs
  -R, --mon_restart        Monitor Restart Count
  -P, --process            Process to check (may be repeated)
  -S, --stop_error         Report an error if process is stopped
  --rwarn, --restart_warn  Warning threshold for restart count
  --rcrit, --restart_crit  Critical threshold for restart count
  --cwarn, --cpu_warn      Warning threshold for cpu usage (percentage value)
  --ccrit, --cpu_crit      Critical threshold for cpu usage (percentage value)
  --mwarn, --mem_warn      Warning threshold for memory usage (in MB)
  --mcrit, --mem_crit      Critical threshold for memory usage (in MB)
  --ewarn, --err_warn      Warning interval for new error log (in minutes). Will
                           be warned only after critical interval
  --ecrit, --err_crit      Critical interval for new error log (in minutes)
  --version, -v            Show version number                         [boolean]
  --help, -h               Show help                                   [boolean]

Examples:
  index.js -A -R --rwarn 5 --rcrit 10  Warn if any apps restarted more then 5
                                       times and critical if restarted more than
                                       10 times
```

### Acknowledge error for pm2 applicatons

```
Usage: check_node_pm2 ack [options]

Options:
  --pm-all, --pm_all        To acknowledge all pm2 applications
  --pm-id, --pm_id          pm2 id of the application to acknowledge (may be
                            repeated)
  --pm-ignore, --pm_ignore  pm2 id for an application to ignore (may be
                            repeated)
  --help                    Show help                                  [boolean]
  --version                 Show version number                        [boolean]

Examples:
  index.js ack --pm-all  Acknowledge all error logs
```

Mind that check_node_pm2 has to be run under the same user that started the PM2 daemon.
