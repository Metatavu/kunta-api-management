/*global module:false*/
'use strict';

var util = require('util');
var fs = require("fs");
var config = require("./grunt-config.json");

module.exports = function(grunt) {
  require("load-grunt-tasks")(grunt);
  
  var installPlugins = [];
  var activatePlugins = [];
  var linkPluginsConfig = [];
  
  var plugins = Object.keys(config.management.plugins);
  for (var i = 0, l = plugins.length; i < l; i++) {
    var plugin = plugins[i];
    var settings = config.management.plugins[plugin];
    
    if (settings.file) {
      linkPluginsConfig.push({
        overwrite: true,
        src: settings.file,
        dest: util.format("%s/wp-content/plugins/%s", config.management.path, plugin)
      });
    } else if (settings.url) {
      installPlugins.push(settings.url);
    } else {
      installPlugins.push(plugin);
    }
    
    activatePlugins.push(plugin);
  };
  
  grunt.initConfig({
    "mustache_render": {
      "database-init": {
        files : [{
          data: {
            "DATABASE": config.management.database.name,
            "USER": config.management.database.user,
            "PASSWORD": config.management.database.password,
            "HOST": config.management.database.host||"localhost"
          },
          template: "templates/init-database.sql.mustache",
          dest: "templates/init-database.sql"
        }]
      },
      "database-drop": {
        files : [{
          data: {
            "DATABASE": config.management.database.name
          },
          template: "templates/drop-database.sql.mustache",
          dest: "templates/drop-database.sql"
        }]
      }
    },
    "mysqlrunfile": {
      options: {
        connection: {
          host: config.mysql.host,
          user: config.mysql.user,  
          password: config.mysql.password,
          multipleStatements: true
        }
      },
      "database-init": {
        src: ["templates/init-database.sql"]
      },
      "database-drop": {
        src: ["templates/drop-database.sql"]
      }
    },
    "symlink": {
      "management-plugins": {
        "files": linkPluginsConfig
      }
    },
    "wp-cli": {
      "download": {
        "path": config.management.path,
        "command": "core",
        "subcommand": "download",
        "options": {"locale": "fi"}
      },
      "config": {
        "path": config.management.path,
        "command": "core",
        "subcommand": "config",
        "options": {
          "dbname": config.management.database.name,
          "dbuser": config.management.database.user,
          "dbpass": config.management.database.password,
          "locale": "fi"
        }
      },
      "install": {
        "path": config.management.path,
        "command": "core",
        "subcommand": "install",
        "options": {
          "url": config.management.site.url,
          "title": config.management.site.title,
          "admin_user": config.management.site.adminUser,
          "admin_password": config.management.site.adminPassword,
          "admin_email": config.management.site.adminEmail,
          "skip-email": true
        }
      },
      "install-plugins": {
        "path": config.management.path,
        "command": "plugin",
        "subcommand": "install",
        "arguments": installPlugins.join(' ')
      },
      "activate-plugins": {
        "path": config.management.path,
        "command": "plugin",
        "subcommand": "activate",
        "arguments": activatePlugins.join(' ')
      },
      "update-languages": {
        "path": config.management.path,
        "command": "core",
        "subcommand": "language update"
      },
      "update-plugins": {
        "path": config.management.path,
        "command": "plugin",
        "subcommand": "update",
        "options": {
          "all": true
        }
      }
    },
    "shell": {
      "management-languages-writable": {
        "command": "chmod a+w languages",
        "options": {
          "execOptions": {
            "cwd": config.management.path + "/wp-content"
          }
        }
      },
      "wait-management": {
        "command": util.format("curl --retry-delay 1 --retry 10 -s http://%s", config.management.site.url)
      },
      "visit-management-admin": {
        "command": util.format("curl -s %s/wp-admin > /dev/null", config.management.site.url),
        "options": {
          "failOnError": false
        }
      },
      "start-management-server": {
        "command": util.format("php -S %s -t wp", config.management.site.url)
      }
    },
    "wait": {
      "2s": {
        "options": {
          "delay": 2000
        }
      }
    },
    'bgShell': {
      "start-management-server-background": {
        "cmd": util.format("php -S %s & echo $! > /tmp/management-server.pid", config.management.site.url),
        "bg": true,
        "execOpts": {
          "cwd": config.management.path
        }
      },
      "kill-management-server-background": {
        bg: true,
        cmd: "PID=`cat /tmp/management-server.pid` && kill $PID"
      }
    },
    "clean": {
      "uninstall-management": [ config.management.path ]
    }
  });
  
  grunt.registerTask("install-management", ["mustache_render:database-init", "mysqlrunfile:database-init", "wp-cli:download", "wp-cli:config", "wp-cli:install", "shell:management-languages-writable", "symlink:management-plugins", "wp-cli:install-plugins", "wp-cli:activate-plugins", "bgShell:start-management-server-background", "wait:2s", "shell:visit-management-admin", "bgShell:kill-management-server-background", "wp-cli:update-languages"]);
  grunt.registerTask("uninstall-management", ["mustache_render:database-drop", "mysqlrunfile:database-drop", "clean:uninstall-management"]);
  grunt.registerTask("start-server", ["shell:start-management-server"]);
  
};