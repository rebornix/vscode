/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Spellchecker } from 'spellchecker';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { isMacintosh } from 'vs/base/common/platform';

export var ISpellCheckService = createDecorator<ISpellCheckService>('spellCheckService');

export interface ISpellCheckService {
	_serviceBrand: any;

	createSpellChecker(language: string): Spellchecker;

	getSpellCheckers(): Spellchecker[];

	getSpellChecker(language: string): Spellchecker;
}

export class SpellCheckService implements ISpellCheckService {
	public _serviceBrand: any;
	private _macNativeSpellChecker: Spellchecker;

	constructor() {
	}

	public createSpellChecker(language: string): Spellchecker {
		if (isMacintosh) {
			if (!this._macNativeSpellChecker) {
				this._macNativeSpellChecker = new Spellchecker();
			}
			return this._macNativeSpellChecker;
		}

		return null;
	}

	public getSpellCheckers(): Spellchecker[] {
		if (this._macNativeSpellChecker) {
			return [this._macNativeSpellChecker];
		} else {
			return [];
		}
	}

	public getSpellChecker(language: string): Spellchecker {
		return this._macNativeSpellChecker;
	}
}