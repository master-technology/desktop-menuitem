# desktop-menuitem
Create/Edit Gnome/KDE Desktop files from the CLI

## .desktop file creator/editor
Are you tired of manually creating .desktop files for your desktop?

### Installation
`npm i -g @master.technology/desktopmenuitem`

### Usage
I tend to go to the directory I've downloaded the new "application" and then just type:
`desktopmenuitem ./appname-1.0.0.AppImage` and be done with it.

This will automatically, detect the name as `Appname` (automatically removing the version and .AppImage) and create a new `appname.desktop` file in your user's application folder.  

However, you are free to pass in whole slew of options:

```
--help                     display help
--view                     View file 
--edit                     Call your editor with the file
--list <optional filter>   List all desktop files
--changelog                Show the changelog

-d, --desktop <file>       Desktop file to use
-k, --keywords <keywords>  Set keywords
-m, --mime <type>          Set mime type
-n, --name <name>          Set name (default: App name)
-e, --exec <name>          Setup executable path
-h, --hide                 Hide application (default: false)
-t, --terminal             .desktop is Terminal mode (default: false)
--json <key>               Set key/values from JSON
```

#### Extra Features Usage
 `--list` has an optional filter, so you can do 
`desktopmenuitem --list .local` and it will only show `.desktop` files in a folder that has `.local` in it. 



### Notes
- [.desktop spec](https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html)



### Known issues
- Does not preserve any comments in an existing file
  - The underlying ini load/save module doesn't support this yet.  I would be willing to switch for another no-dependency ini module.  (PR would be welcome)
  
