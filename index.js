#!/usr/bin/env node

var pm2 = require('pm2');
var fs = require('fs');
var os = require('os');
var util = require('util');
var pkg = require('./package.json');
var yargs = require('yargs')
    .usage(pkg.name + ' ' + pkg.version + '\n' + pkg.description + '\n\nUsage: $0 <command> [options]')
    .command('ack','Acknowledge error for pm2 application',function(yargs){
        yargs.option({
            'pm-all': {
                alias: 'pm_all',
                describe: 'To acknowledge all pm2 applications'
            },
            'pm-id': {
                alias: 'pm_id',
                describe: 'pm2 id of the application to acknowledge (may be repeated)'
            },
            'pm-ignore': {
                alias: 'pm_ignore',
                describe: 'pm2 id for an application to ignore (may be repeated)'

            }
        })
        //yargs.reset()
        yargs.usage(pkg.name + ' ' + pkg.version + '\n' + pkg.description + '\n\nUsage: $0 ack [options]')
        yargs.help()
        yargs.version(pkg.version)
        yargs.example('$0 ack --pm-all','Acknowledge all error logs')
        yargs.argv
    })
    .option('A', {
        desc: 'Check all processes',
        global: false
    })
    .option('I', {
        desc: 'Ignore process (may be repeated)',
        global: false
    })
    .option('C', {
        desc: 'Monitor CPU usage',
        global: false
    })
    .option('M', {
        desc: 'Monitor MEM usage',
        global: false
    })
    .option('E', {
        desc: 'Monitor error logs',
        global: false
    })
    .option('R', {
        desc: 'Monitor Restart Count',
        global: false
    })
    .option('P', {
        desc: 'Process to check (may be repeated)',
        global: false
    })
    .option('S', {
        desc: 'Report an error if process is stopped',
        global: false
    })
    .option('rwarn', {
        desc: 'Warning threshold for restart count',
        global: false
    })
    .option('rcrit', {
        desc: 'Critical threshold for restart count',
        global: false
    })
    .option('cwarn', {
        desc: 'Warning threshold for cpu usage (percentage value)',
        global: false
    })
    .option('ccrit', {
        desc: 'Critical threshold for cpu usage (percentage value)',
        global: false
    })
    .option('mwarn', {
        desc: 'Warning threshold for memory usage (in MB)',
        global: false
    })
    .option('mcrit', {
        desc: 'Critical threshold for memory usage (in MB)',
        global: false
    })
    .option('ewarn', {
        desc: 'Warning interval for new error log (in minutes). Will be warned only after critical interval',
        global: false
    })
    .option('ecrit', {
        desc: 'Critical interval for new error log (in minutes)',
        global: false
    })
    .example('$0 -A -R --rwarn 5 --rcrit 10','Warn if any apps restarted more then 5 times and critical if restarted more than 10 times')
    .default({

    })
    .version(pkg.version)
    .help()
    .alias({
        'A': 'all',
        'I': 'ignore',
        'P': 'process',
        'S': 'stop_error',
        'C': 'mon_cpu',
        'M': 'mon_mem',
        'R': 'mon_restart',
        'E': 'mon_err',
        'cwarn': 'cpu_warn',
        'ccrit': 'cpu_crit',
        'mwarn': 'mem_warn',
        'mcrit': 'mem_crit',
        'rwarn': 'restart_warn',
        'rcrit': 'restart_crit',
        'ewarn': 'err_warn',
        'ecrit': 'err_crit',
        'help': 'h',
        'version': 'v'
    })
    .showHelpOnFail(false, "Use --help for available options")
    .strict()
    .argv;

if (yargs.ignore && !(yargs.ignore instanceof Array)) yargs.ignore = [yargs.ignore];
if (yargs.process && !(yargs.process instanceof Array)) yargs.process = [yargs.process];

if (!yargs.ignore) yargs.ignore = [];
if (!yargs.process) yargs.process = [];

var curr_exit = 0;
var output = [];

var procs = [];

var perfdata = {}

function updateOutput(message,exit_code){
    if(exit_code >= curr_exit){
        curr_exit = exit_code
        output.unshift(message)
    }
    else{
        output.push(message)
    }
}

function getExitMessage(exit_code){
    switch(exit_code){
        case 0: return 'OK';
        case 1: return 'WARNING';
        case 2: return 'CRITICAL';
        case 3: return 'UNKNOWN';
    }
}

function addPerfData(name,val,warn,crit,min,max){
    perfdata[name] = [val,warn,crit,min,max]
}

function exit_now(message,normal_exit){
    if (normal_exit){
        console.log(message);
        process.exit(0);
    }
    console.log('UNKNOWN '+message);
    process.exit(3);
}

function getPerfData(){
    var perfdataString = '';
    for (data in perfdata){
        perfdataString += data+'='+perfdata[data].join(';')+' ';
    }
    return perfdataString;
}

function read_stats_file(){
    var error_stats = {};
    var stat_dir = os.homedir()+'/.check_node_pm2'
    if (!fs.existsSync(stat_dir)){
        fs.mkdirSync(stat_dir);
    }
    try{
        fs.readFileSync(stat_dir+'/stats').toString().split('\n').forEach(function (line) { 
            var stat = line.split('\t');
            if (stat[0]){
                error_stats[stat[0]] = {
                    'timestamp':stat[1],
                    'ack_stat':stat[2]
                }
            }
        });
        return error_stats;
    }
    catch(err){
        return {}
        //File doesnot exists
    }
}

function write_stats_file(error_stats){
    var stat_dir = os.homedir()+'/.check_node_pm2'
    var stats = '';
    for (stat in error_stats){
        if (stat){
            stats += stat+'\t'+error_stats[stat]['timestamp']+'\t'+error_stats[stat]['ack_stat']+'\n';
        }
    }
    fs.writeFileSync(stat_dir+'/stats',stats);
}

function manage_exit(){
    console.log(getExitMessage(curr_exit) + ':', output.join(', ')+' | '+getPerfData());
    process.exit(curr_exit);
}

if (yargs._ == 'ack'){
    //In some systems pm_id and pm-id are considered different arguments
    if (yargs['pm-all'] && !yargs['pm_all']){
        yargs.pm_all = yargs['pm-all'];
    }
    //In some systems pm_id and pm-id are considered different arguments
    if (yargs['pm-id'] && !yargs['pm_id']){
        yargs.pm_id = yargs['pm-id'];
    }
    //In some systems pm-ignore and pm_ignore are considered different arguments
    if (yargs['pm-ignore'] && !yargs['pm_ignore']){
        yargs.pm_ignore = yargs['pm-ignore'];
    }
    //In some systems pm-all and pm_all are considered different arguments
    if (yargs['pm-all'] && !yargs['pm_all']){
        yargs.pm_all = yargs['pm-all'];
    }
    if (yargs.pm_id && !(yargs.pm_id instanceof Array)){
        yargs.pm_id = [yargs.pm_id];
    }
    else if(!yargs.pm_id){
        yargs.pm_id = [];
    }
    if (yargs.pm_ignore && !(yargs.pm_ignore instanceof Array)){
        yargs.pm_ignore = [yargs.pm_ignore];
    }
    else if(!yargs.pm_ignore){
        yargs.pm_ignore = [];
    }
    var error_stats = read_stats_file()
    if (!yargs.pm_all && (!yargs.pm_id || yargs.pm_id.length === 0)) {
        exit_now('No application given (use --pm-all for all or --pm-id for a particular id)',true);
    }
    for (stat in error_stats){
        if ((yargs.pm_all || (yargs.pm_id.indexOf(parseInt(stat)) !== -1)) && (yargs.pm_ignore.indexOf(parseInt(stat)) === -1)){
            error_stats[stat]['ack_stat'] = 1;
        }
    }
    write_stats_file(error_stats);
    exit_now(JSON.stringify(error_stats,null,2),true);
}

if (!yargs.all && (!yargs.process || yargs.process.length === 0)) {
    exit_now('No application given (use -A for all)');
}

var error_stats = {};
var error_stats_modified = false;
if (yargs.mon_err){
    error_stats = read_stats_file();
}


// Connect or launch PM2
pm2.connect(function (err) {

    // Get all processes running
    pm2.list(function (err, process_list) {


        process_list.forEach(function (proc) {
            var env = proc.pm2_env;
            procs.push(proc.name);
            proc_name_id = proc.name + '(' + env.pm_id + ')'
            if ((yargs.all || yargs.process.indexOf(proc.name) !== -1 ) && yargs.ignore.indexOf(proc.name) === -1) {

                switch (env.status) {
                    case 'online':
                        updateOutput(proc_name_id+ ' online',0);
                        break;
                    case 'stopped':
                        if (yargs.stop_error) {
                            updateOutput(proc_name_id+ ' stopped',2);
                        } else {
                            updateOutput(proc_name_id+ ' stopped',1);
                        }
                        break;
                    case 'errored':
                        updateOutput(proc_name_id+ ' errored',2);
                        break;
                    default:
                        updateOutput(proc_name_id+' '+env.status,3);
                }
                
                if (yargs.mon_restart){
                    var restart_crit = parseInt(yargs.restart_crit, 10);
                    var restart_warn = parseInt(yargs.restart_warn, 10);
                    if (!(yargs.restart_crit && yargs.restart_warn)){
                        exit_now('Invalid warning or critical value for restart count');
                    }
                    else if ( restart_crit < env.restart_time) {
                        updateOutput(proc_name_id + ' restarted ' + env.restart_time + ' times',2);
                    }
                    else if ( restart_warn < env.restart_time){
                        updateOutput(proc_name_id + ' restarted ' + env.restart_time + ' times',1);
                    }
                    addPerfData('restart_count_'+proc_name_id,env.restart_time,restart_warn,restart_crit,0,'');
                }

                if (yargs.mon_cpu){
                    var cpu_crit = parseInt(yargs.cpu_crit);
                    var cpu_warn = parseInt(yargs.cpu_warn);
                    if (!( cpu_crit && cpu_warn)){
                        exit_now('Invalid warning or critical value for cpu usage');
                    }
                    else if (cpu_crit < proc.monit.cpu) {
                        updateOutput(proc_name_id + ' cpu usage ' + proc.monit.cpu + '%',2);
                    }
                    else if (cpu_warn < proc.monit.cpu){
                        updateOutput(z + ' cpu usage ' + proc.monit.cpu + '%',1);
                    }
                    else{
                        updateOutput(proc_name_id+' cpu usage '+proc.monit.cpu+'%')
                    }
                    addPerfData('cpu_usage_'+proc_name_id,proc.monit.cpu+'%',cpu_warn,cpu_crit,0,'');
                }

                if (yargs.mon_mem){
                    mem_usage = proc.monit.memory/(1024*1024);
                    mem_crit = parseInt(yargs.mem_crit, 10);
                    mem_warn = parseInt(yargs.mem_warn, 10);
                    if (!(mem_crit && mem_warn)){
                        exit_now('Invalid warning or critical value for memory usage');
                    }
                    else if (mem_crit < mem_usage) {
                        updateOutput(proc_name_id + ' mem usage ' + mem_usage,2);
                    }
                    else if (mem_warn< mem_usage){
                        updateOutput(proc_name_id + ' mem usage ' + mem_usage,1);
                    }
                    else{
                        updateOutput(proc_name_id + ' mem usage ' + mem_usage,0);
                    }
                    addPerfData('mem_usage_'+proc_name_id,mem_usage+'MB',mem_warn,mem_crit,0,'');
                }

                if (yargs.mon_err){
                    err_warn = parseInt(yargs.err_warn)*60*1000
                    err_crit = parseInt(yargs.err_crit)*60*1000
                    if (!(err_crit && err_warn && (err_warn > err_crit))){
                        exit_now('Invalid warning or critical value for error log interval');
                    }
                    var err_log_path = env.pm_err_log_path;
                    if (!fs.existsSync(err_log_path)){
                        updateOutput(proc_name_id + ' error log not found',1);
                    }
                    else{
                        var stats = fs.statSync(err_log_path);
                        var last_modified_time = new Date(util.inspect(stats.mtime))/1;
                        var time_since_last_err = (new Date()/1) - last_modified_time;
                        if ((error_stats[env.pm_id]) && (error_stats[env.pm_id]['timestamp'] == last_modified_time)){
                            if(time_since_last_err > err_warn){
                                //error_stats[proc_name_id]['ack_stat'] = 1;
                                delete error_stats[env.pm_id]
                                error_stats_modified = true;
                            }
                        }
                        else{
                            /*
                            //Script to read last 5 lines of error log
                            var lines = fs.readFileSync(err_log_path,'utf8').toString().split('\n')
                            if (lines.length > 5){
                                lines = lines.slice(lines.length-5)
                            }
                            */
                            error_stats[env.pm_id] = {
                                'timestamp': last_modified_time,
                                'ack_stat': 0,
                            };
                            error_stats_modified =true;
                        }
                        if (error_stats[env.pm_id] && error_stats[env.pm_id]['ack_stat'] == 0){
                            if (time_since_last_err < err_crit){
                                updateOutput(proc_name_id + ' error log updated',2);
                            }
                            else if (time_since_last_err < err_warn){
                                updateOutput(proc_name_id + ' error log updated',1);
                            }
                        }
                    }
                }
            }
        });

        if(output == []){
            updateOutput('No app found in pm2')
        }

        // Disconnect to PM2
        pm2.disconnect(function () {
            if (error_stats_modified){
                write_stats_file(error_stats)
            }
            manage_exit();
        });
    });

});
