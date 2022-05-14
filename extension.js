// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const fs = require('fs');
const { homedir } = require('os');
const { sep, dirname } = require('path');
const vscode = require('vscode');

const getScriptDir = () => homedir() + `${sep}.scriptbox${sep}`;

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

const getParamNames = func => {
	var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,
		ARGUMENT_NAMES = /([^\s,]+)/g,
		fnStr = func.toString().replace(STRIP_COMMENTS, ''),
		result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
	if(result === null)
		result = [];
	return result;
}

const strToRegex = inputstring => {
    var match = inputstring.match(/^\/(.*?)\/([gimy]*)$/);
    if (match)
        return regex = new RegExp(match[1], match[2]);
	return null;
}

const executeScript = module => {
	const editor = vscode.window.activeTextEditor;
	var params = getParamNames(module.script);
	params.shift();
	try {
		promptParamsAndRunCB(params, (values)=>{
			var run = reg => editor.edit(builder=>{
				module.script.apply(vscode, [getCurrentTextSelections(editor, builder, reg), ...values]);
			});
			if (typeof(module.regexp) === "string"){
				vscode.window
					.showInputBox({
						placeHolder: module.regexp
					})
					.then(val => {
						var input = strToRegex(val);
						if (input)
							run(input);
						else throw "Input is not a regular expression.";
					});
			} else {
				run(module.regexp);
			}
			
		});
	  } catch (err) {
		vscode.window.showErrorMessage(err.message);
	  }
}
const promptParamsAndRunCB = (params, cb, values = [...params])=>{
	if (params.length == 0){
		cb(values);
		return;
	}
	vscode.window
		.showInputBox({
			placeHolder: params.shift()
		})
		.then(val => {
			values[values.length - params.length - 1] = val;
			promptParamsAndRunCB(params, cb, values);
		});
}

const regMatches = (reg, str)=>{
	var out = [];
	var res;
	while((res = reg.exec(str)) !== null){
		out.push(
			{
				match: res.shift(),
				captures: [...res],
				index: res.index
			}
		)
	}
	return out;
}

const getCurrentTextSelections = (editor, builder, regexp) => {
	if (!editor) {
	  return;
	}
  
	selections = editor.selections;
	if (selections.length === 0 || selections.length === 1 && selections[0].isEmpty) {
		var doc = editor.document.getText(),
			startPos = editor.document.positionAt(0),
			endPos = editor.document.positionAt(doc.length - 1);
	  selections = [new vscode.Selection(startPos, endPos)];
	}
	var i = 0,
		ii = -1,
		lastLine;
	return selections.map(s=>{
		var start = s.start,
			end = s.end,
			text = editor.document.getText(s),
			regRes;

		start = {line: start.line, char: start.character};
		end = {line: end.line, char: end.character};
		if (lastLine !== start.line)
			ii++;
		lastLine = start.line;
		console.log(regexp);

		if (regexp){
			console.log(regexp);

			var startIndex = editor.document.offsetAt(s.start),
				mi = 0,
				mii = -1,
				mLastLine;
			regRes = regMatches(regexp, text).map(o => {
				var mStart = editor.document.positionAt(startIndex + o.index), 
					mEnd = editor.document.positionAt(startIndex + o.index + o.match.length - 1);
				var sel = new vscode.Selection(mStart, mEnd);
				mStart = {line: mStart.line, char: mStart.character};
				mEnd = {line: mEnd.line, char: mEnd.character};
				if (mLastLine !== mStart.line)
					mii++;
				mLastLine = mStart.line;

				return {
					text: o.match,
					captures: o.captures,
					start: mStart,
					end: mEnd,
					isEmpty: sel.isEmpty,
					isReversed: sel.isReversed,
					index: mi++,
					lineIndex: mii,
					replace: text=>{builder.replace(sel, text)}
				};
			})
		}
		return {
			text: text,
			start: start,
			end: end,
			isEmpty: s.isEmpty,
			isReversed: s.isReversed,
			index: i++,
			lineIndex: ii,
			matches: regRes,
			replace: text=>{builder.replace(s, text)}
		};
	});
	// return editor.document.getText(selection);
};

function writeFile(path, contents) {
	
	fs.writeFileSync(path, contents, cb);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "selescript" is now active!');
	const scriptsDir = getScriptDir(context);
	fs.mkdirSync(scriptsDir, { recursive: true});


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
				
				fs.writeFileSync(newScriptPath, SCRIPT_TEMPLATE, "UTF-8");
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
