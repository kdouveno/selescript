// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');


const SCRIPT_TEMPLATE = `
module.exports = function (selection) {
  // selection is a string containing:
  // 1. the current text selection
  // 2. the entire contents of the active editor when nothing is selected
  return selection;
};
`.trim();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

const openScriptForEditing = scriptPath => {
	vscode.workspace.openTextDocument(scriptPath).then(
	  document =>
		vscode.window.showTextDocument(
		  document,
		  vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: 1
		),
	  err => {
		console.error(err);
	  }
	);
  };
function getScriptsDir(context){
	return context.globalStorageUri.path + "/scripts/";
}

function ensureDirectoryExistence(filePath) {
	var dirname = path.dirname(filePath);
	console.log(dirname);
	if (fs.existsSync(dirname)) {
	  return true;
	}
	ensureDirectoryExistence(dirname);
	fs.mkdirSync(dirname);
}

const enumerateScripts = dir =>
  new Promise((resolve, reject) =>
    fs.readdir(dir, (err, files) => {
      if (err && err.code === "ENOENT") {
        reject(new Error(`${dir} does not exist`));
      } else if (err) {
        reject(err);
      } else {
        resolve(files);
      }
    })
);
const createQuickPickItemsForScripts = (scripts) =>
  scripts.map(script => ({
    script,
    label: script,
    description: `Execute '${script}' on the selected text`
  }));

const loadScript = path => {
	try {
	  delete require.cache[require.resolve(path)];
	  return require(path);
	} catch (err) {
	  throw new Error(`Error loading '${path}': ${err.message}`);
	}
};

const executeScript = module => {
	const editor = vscode.window.activeTextEditor;

	editor.edit(builder=>{
		const context = {
			vscode: vscode,
			selections: getCurrentTextSelections(editor, builder)
		};
		module.apply(context);
	});
  
}

const getCurrentTextSelections = (editor, builder) => {
  
	if (!editor) {
	  return;
	}
  
	const selections = editor.selections;
	if (selections.length === 1 && selections[0].isEmpty) {
	  return editor.document.getText();
	}
	var i = 0, ii = -1, lastLine;
	return selections.map(s=>{
		var start = s.start;
		start = {line: start.line, char: start.character};
		var end = s.end;
		end = {line: end.line, char: end.character};
		if (lastLine !== start.line)
			ii++;
		lastLine = start.line;
		return {
			text: editor.document.getText(s),
			start: start,
			end: end,
			isEmpty: s.isEmpty,
			isReversed: s.isReversed,
			index: i++,
			lineIndex: ii,
			replace: text=>{builder.replace(s, text)}
		};
	});
	// return editor.document.getText(selection);
};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "selescript" is now active!');
	const scriptsDir = getScriptsDir(context);

	ensureDirectoryExistence(scriptsDir+"kamoule");

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('selescript.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from SeleScript! ');
	}));
	context.subscriptions.push(
		vscode.commands.registerCommand("selescript.createScript", async () => {
		  try {
			vscode.window
			  .showInputBox({
				placeHolder: "Script Name"
			  })
			  .then(scriptName => {
				const newScriptPath = scriptsDir + scriptName + ".js";
				
				fs.writeFileSync (newScriptPath, SCRIPT_TEMPLATE, "UTF-8");
	
				openScriptForEditing(newScriptPath);
			  });
		  } catch (err) {
			vscode.window.showErrorMessage(err.message);
		  }
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("selescript.editScript", async () => {

		  try {
			const scripts = await enumerateScripts(scriptsDir);
	
			const scriptItems = createQuickPickItemsForScripts(scripts);
			console.log(scriptItems);
			const pickedScript = await vscode.window.showQuickPick(scriptItems);
	
			if (pickedScript) {
			  const pickedScriptPath = scriptsDir + pickedScript.script;
	
			  openScriptForEditing(pickedScriptPath);
			}
		  } catch (err) {
			vscode.window.showErrorMessage(err.message);
		  }
		})
	  );
	  context.subscriptions.push(
		vscode.commands.registerCommand("selescript.runScript", async () => {
		  try {
			const scripts = await enumerateScripts(scriptsDir);
	
			const scriptItems = createQuickPickItemsForScripts(scripts);
	
			const pickedScript = await vscode.window.showQuickPick(scriptItems);
	
			if (pickedScript) {
			  const pickedScriptPath = scriptsDir + pickedScript.script;
			  const module = loadScript(pickedScriptPath);
			  executeScript(module);
			}
		  } catch (err) {
			vscode.window.showErrorMessage(err.message);
		  }
		})
	  );
	  context.subscriptions.push(
		vscode.commands.registerCommand("selescript.test", async () => {
			const editor = vscode.window.activeTextEditor;
			console.log(editor.selection);
			console.log(editor.selections);
		})
	  );
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
