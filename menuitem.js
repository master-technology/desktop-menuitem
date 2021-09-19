#!/usr/bin/env node

/*****************************************************************************************
 * (c) 2021, Master Technology
 * Licensed under the MIT license or contact me for a support, changes, enhancements,
 * and/or if you require a commercial licensing
 *
 * Any questions please feel free to email me or put a issue up on github
 *
 *                                                               Nathan@master.technology
 ****************************************************************************************/
"use strict";

// .desktop file Specs: https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html

const { Command } = require('commander');
const ini = require('ini');
const fs = require('fs');
const path = require("path");
const child = require("child_process");
require('colors');

// Setup the Version
const packageJSON = require("./package.json");
const version = packageJSON.version;

// These are the locations where the .desktop files can reside
const pathsToCheck = [process.env.HOME+'/.local/share/applications/', '/usr/local/share/applications/', '/usr/share/applications/'];
addPathsToCheck(process.env['XDG_DATA_DIRS']?.split(":") || []);
addPathsToCheck(process.env['XDG_DATA_HOME']?.split(':') || []);


// noinspection SpellCheckingInspection
console.log("\r\ndesktopmenuitem".blue,version.blue, "\r\n---------------------");
const program = new Command();
// noinspection SpellCheckingInspection
program.name("desktopmenuitem".blue).usage("[options]".red + " and/or "+"[executable file]".red).version(version);
program.showHelpAfterError('Use --help for additional information');
program.description('An application for creating or editing .desktop files');
program.option("--view", "View .desktop file");
program.option("--edit", "Call your editor with the .desktop file");
program.option("--list", "List all .desktop files" );
program.option("-d, --desktop <file>", "Desktop file to use");
program.option("-k, --keywords <keywords>", "Set keywords");
program.option("-m, --mime <type>", "Set mime type");
program.option("-n, --name <name>", "Set name (default: App name)");
program.option("-e, --exec <name>", "Setup executable path");
program.option("-i, --icon <name>", "Icon name");
program.option("-h, --hide", "Hide application from menu", false);
program.option("-t, --terminal", "App requires terminal", false);
program.option("--json <key>", "Set key/values from JSON");

program.parse(process.argv);

const options = program.opts();

// List Directories
if (options.list) {
    pathsToCheck.forEach((val) => {
        listDirectory(val);
        console.log("");
    });
    process.exit(0);
}

// Show Help if no arguments are passed in
if (program.args.length === 0) {
    program.help();
    process.exit(0);
}

// Convert the JSON to object if it was passed in
if (options.json) {
    try {
        options.json = JSON.parse(options.json);
    } catch (e) {
        console.log("JSON is invalid: ".red, e.toString().red);
        console.log("Please make sure to escape and pass it in as a string like: \"{\\\"key\\\":true}\"");
        process.exit(0);
    }
}


// Lets find the .desktop file
let desktopFile = '';
if (program.args.length && program.args[0].endsWith(".desktop")) {
    // If the file actually ends with .desktop, then this is the name
    desktopFile = path.basename(program.args[0]);
} else if (options.desktop && options.desktop !== '') {
    // Otherwise check to see if they used the --desktop option
    desktopFile = options.desktop;
    if (!desktopFile.endsWith(".desktop")) {
        desktopFile += ".desktop";
    }
} else if (program.args.length) {
    // Finally we will assume it is the name passed in + ".desktop"
    desktopFile = cleanName(path.basename(program.args[0])) + ".desktop";
}

// Figure out the Application Name to show as the Menu
if (options.name == null || options.name.length === 0) {
    if (program.args.length) {
        options.dynamicName = cleanName(path.basename(program.args[0], ".desktop"));
    } else if (options.desktop != null && options.desktop.length) {
        options.dynamicName = path.basename(options.desktop, ".desktop");
    }
}

// Figure out the Exec Path
if (options.exec == null || options.exec.length === 0) {
    if (program.args.length) {
        options.dynamicExec = pathNormalize(program.args[0]);
    }
} else {
    options.exec = pathNormalize(options.exec);
}

const info = loadFile(desktopFile);
if (options.edit && !info._created) {
    spawnEditor(info._pathToDesktopFile);
    process.exit(0);
}

// If they just want to view the file...
if (options.view) {
    console.log(info);
    process.exit(0);
}

if (configureDesktopEntry(info)) {
//    console.log(info);
    const fileName = info['_pathToDesktopFile'];
    delete info['_pathToDesktopFile'];
    delete info['_created'];
    fs.writeFileSync(fileName, ini.stringify(info));
    if (options.edit) {
        spawnEditor(fileName);
    } else {
        console.log("Saved:", fileName);
    }
} else {
    console.log("No Changes");
}

// -------------------------------------------------------------------------------------------------
// Support Functions
// -------------------------------------------------------------------------------------------------

/**
 * Attempts to figure out the editor, defaults to ubuntu's "editor" command if env vars aren't set
 */
function spawnEditor(file) {
    let editorName = process.env.EDITOR || process.env.VISUAL || "/usr/bin/editor";
    if (editorName === "$VISUAL") { editorName = process.env.VISUAL || "/usr/bin/editor"; }

    if (editorName == null || editorName.length === 0 || !fs.existsSync(editorName)) {
        console.error("Invalid editor".red, editorName != null ? editorName.red : "Unable to determine editor to use.");
        process.exit(1);
    }

    child.spawnSync(editorName, [file], {
        stdio: 'inherit'
    });
}

/**
 * Updates the .desktop file
 * @param info
 * @returns {boolean}
 */
function configureDesktopEntry(info) {
    let changed = 0;
    const DE = info["Desktop Entry"];
    if (options.exec?.length && options.exec !== DE.Exec) {
        changed++;
        DE.Exec = options.exec;
    } else if (DE.Exec === '' && options.dynamicExec) {
        changed++;
        DE.Exec = options.dynamicExec;
    }
    if (changed) {
        if (!fs.existsSync(DE.Exec)) {
            console.log("Executable".red,DE.Exec.green, "does not exist".red);
            process.exit(1);
        }
    }

    if (options.icon?.length && DE.Icon !== options.icon) {
        changed++;
        DE.Icon = options.icon;
    }

    if (options.hide === true && DE.NoDisplay !== true) {
        changed++;
        DE.NoDisplay = true;
    }

    if (options.name?.length && DE.Name !== options.name) {
        changed++;
        DE.Name = options.name;
    } else if (DE.Name === '' && options.dynamicName) {
        changed++;
        DE.Name = options.dynamicName;
    }

    if (options.terminal && DE.Terminal !== options.terminal) {
        changed++;
        DE.Terminal = options.terminal;
    }

    if (options.keywords && DE.Keywords !== options.keywords) {
        changed++;
        DE.Keywords = options.keywords;
    }

    if (options.mime && DE.mimeType !== options.mime) {
        changed++;
        DE.mimeType = options.mime;
    }

    if (options.json) {
        for (let key in options.json) {
            if (options.json[key] !== DE[key]) {
                changed++;
                DE[key] = options.json[key];
            }
        }
    }

    return changed > 0;
}

/**
 * Cleans up the name to be more usable
 * @param name
 * @returns {string}
 */
function cleanName(name) {
   // Remove known app extensions
   let newName = name.replace(/\.appimage/gi,"");


   let offset=0;
   do {
       offset = findFirstOffset(newName, offset);
       let added = 1;
       // See if a Version number exists
       if (offset > -1) {
          offset++;
          let c = newName.charCodeAt(offset);
          // See if it is a "v"
          if (c === 118 || c === 86) {
              offset++;
              added++;
              c = newName.charCodeAt(offset);
          }

          // Check for 0 - 9
          if (c >= 48 && c <= 57) {
              // Strip out everything past the version number
              newName = newName.substr(0, offset-added);
              offset = -1;
          }
       }
   } while (offset !== -1);

   // Upper case first letter
   return newName.substr(0,1).toUpperCase()+newName.substr(1);
}

/**
 * Finds the First offset of a period, underscore or slash in the file name
 * @param name
 * @param start
 * @returns {number}
 */
function findFirstOffset(name, start) {
    let offset1 = name.indexOf("-", start);
    let offset2 = name.indexOf("_", start);
    let offset3 = name.indexOf(".", start);

    // See if any -._ exist in file name, if none then just return
    if (offset1 === -1 && offset2 === -1 && offset3 === -1) { return -1; }

    //  Offset 2 < Offset 1
    if (offset1 === -1 || (offset1 >= 0 && offset2 >= 0 && offset2 < offset1)) {
        offset1 = offset2;
    }

    // Offset 3 < offset 1
    if (offset1 === -1 || (offset1 >= 0 && offset3 >= 0 && offset3 < offset1)) {
        offset1 = offset3;
    }
    return offset1;
}

/**
 * Lists the .desktop files in a directory
 * @param path
 */
function listDirectory(path) {
    if (!fs.existsSync(path)) return;
    const data = fs.readdirSync(path);
    let hasPrinted=false;
    data.forEach((val) => {
        if (val.endsWith(".desktop")) {
            if (!hasPrinted) {
                hasPrinted=true;
                console.log(path.blue);
            }
            console.log("  ", val.replace(".desktop", "").green);
        }
    });
}

/**
 * This finds and loads a .desktop file, or creates a new .desktop file
 * @param fileName
 * @returns {{"Desktop Entry": {Exec: string, Type: string, Keywords: string, Categories: string, Icon: string, Terminal: boolean, MimeType: string, Name: string}, _created: boolean, _pathToDesktopFile: string}|*}
 */
function loadFile(fileName) {
    //console.log("Searching for:", fileName.blue);
    for (let i=0;i<pathsToCheck.length;i++) {
        if (fs.existsSync(pathsToCheck[i]+fileName)) {
                console.log("Loading:", (pathsToCheck[i]+ fileName).blue);
                return parseFile(pathsToCheck[i] + fileName);
        }
    }

    console.log("Creating:", (pathsToCheck[0]+fileName).blue);
    return {
        "Desktop Entry":
            {
                Type: "Application",
                Terminal: false,
                Keywords: '',
                MimeType: '',
                Categories: '',
                Name: '',
                Icon: '',
                Exec: ''
            },
        _pathToDesktopFile: pathsToCheck[0] + fileName,
        _created: true
    };
}

/**
 * This Parses the .desktop file
 * @param file {string}
 * @returns {object}
 */
function parseFile(file) {
    let data = ini.parse(fs.readFileSync(file, 'utf-8'));
    data._pathToDesktopFile = file;
    return data;
}

/***
 * Used to add new paths from Env variables/array to the paths to check
 * @param paths
 */
function addPathsToCheck(paths) {
    for (let i=0;i<paths.length;i++) {
        let newPath = paths[i] + '/applications/';
        if (pathsToCheck.indexOf(newPath) === -1) {
            pathsToCheck.push(newPath);
        }
    }
}

/**
 * This normalizes the path, so it is always absolute
 * @param inPath
 * @returns {string}
 */
function pathNormalize(inPath) {
    let tempFile = path.normalize(inPath);
    if (tempFile.startsWith("/")) {
        return tempFile;
    } else {
        return path.normalize(process.cwd() + "/" + tempFile);
    }
}
