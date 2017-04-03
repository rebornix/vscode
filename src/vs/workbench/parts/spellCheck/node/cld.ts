/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cld from 'cld';

export function detect(text: string, options: any) {
	return new Promise((res, rej) => {
		cld.detect(text, options, (err, result) => {
			if (err) { rej(new Error(err.message)); return; }
			if (!result.reliable || result.languages[0].percent < 85) {
				rej(new Error('Not enough reliable text'));
				return;
			}

			res(result.languages[0].code);
		});
	});
}
