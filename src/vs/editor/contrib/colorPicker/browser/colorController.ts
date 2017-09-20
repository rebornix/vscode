import * as nls from 'vs/nls';
import * as editorCommon from 'vs/editor/common/editorCommon';
import { EditorAction, editorTouchbarAction } from 'vs/editor/common/editorCommonExtensions';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ColorDetector } from 'vs/editor/contrib/colorPicker/browser/colorDetector';
import { Color } from 'vs/base/common/color';

@editorTouchbarAction
export class StartColorPickerAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.colorPicker',
			label: nls.localize('startColorPicker', "ColorPicker"),
			alias: 'Find',
			precondition: null,
			kbOpts: {
				kbExpr: null,
				primary: KeyMod.CtrlCmd | KeyCode.KEY_Y,
				mac: {
					primary: KeyMod.CtrlCmd | KeyCode.KEY_Y
				}
			},
			menuOpts: {
				group: 'touchBar',
				order: 1
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: editorCommon.ICommonCodeEditor, args: any): void {
		let rgba = Color.Format.CSS.parseHex(args.args.color).rgba;
		editor.getContribution<ColorDetector>('editor.contrib.colorDetector').updateColorData(editor.getSelection().getStartPosition(), {
			red: rgba.r / 255,
			green: rgba.g / 255,
			blue: rgba.b / 255,
			alpha: rgba.a
		});
		editor.getAction('editor.action.showHover').run();
	}
}