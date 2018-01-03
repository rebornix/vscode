/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Range } from 'vs/editor/common/core/range';
import { Position } from 'vs/editor/common/core/position';
import * as editorCommon from 'vs/editor/common/editorCommon';
import * as strings from 'vs/base/common/strings';
import { PrefixSumComputer } from 'vs/editor/common/viewModel/prefixSumComputer';
import { ITextSource, IRawPTBuffer } from 'vs/editor/common/model/textSource';
import { ApplyEditResult, IInternalModelContentChange } from 'vs/editor/common/model/textBuffer';
import { IValidatedEditOperation } from 'vs/editor/common/model/editableTextModel';
import { ModelRawChange, ModelRawLineChanged, ModelRawLinesDeleted, ModelRawLinesInserted } from 'vs/editor/common/model/textModelEvents';

export const enum NodeColor {
	Black = 0,
	Red = 1,
}

export let error = {
	sizeLeft: false
};

function getNodeColor(node: TreeNode) {
	return node.color;
}

function setNodeColor(node: TreeNode, color: NodeColor) {
	node.color = color;
}

function leftest(node: TreeNode): TreeNode {
	while (node.left !== SENTINEL) {
		node = node.left;
	}
	return node;
}

function righttest(node: TreeNode): TreeNode {
	while (node.right !== SENTINEL) {
		node = node.right;
	}
	return node;
}

/**
 *       y                 x
 *     /  \              /  \
 *    x    c    <----   a    y
 *  /  \                   /  \
 * a    b                 b    c
 *
 * @param tree
 * @param x
 */
function leftRotate(tree: TextBuffer, x: TreeNode) {
	let y = x.right;

	// fix size_left
	y.size_left += x.size_left + (x.piece ? x.piece.length : 0);
	y.lf_left += x.lf_left + (x.piece ? x.piece.lineFeedCnt : 0);
	x.right = y.left;

	if (y.left !== SENTINEL) {
		y.left.parent = x;
	}
	y.parent = x.parent;
	if (x.parent === SENTINEL) {
		tree.root = y;
	} else if (x.parent.left === x) {
		x.parent.left = y;
	} else {
		x.parent.right = y;
	}
	y.left = x;
	x.parent = y;
}

/**
 *       y                 x
 *     /  \              /  \
 *    x    c    ---->   a    y
 *  /  \                   /  \
 * a    b                 b    c
 *
 * @param tree
 * @param x
 */
function rightRotate(tree: TextBuffer, y: TreeNode) {
	let x = y.left;
	y.left = x.right;
	if (x.right !== SENTINEL) {
		x.right.parent = y;
	}
	x.parent = y.parent;

	// fix size_left
	y.size_left -= x.size_left + (x.piece ? x.piece.length : 0);
	y.lf_left -= x.lf_left + (x.piece ? x.piece.lineFeedCnt : 0);

	if (y.parent === SENTINEL) {
		tree.root = x;
	} else if (y === y.parent.right) {
		y.parent.right = x;
	} else {
		y.parent.left = x;
	}

	x.right = y;
	y.parent = x;
}

/**
 *      node              node
 *     /  \              /  \
 *    a   b    <----   a    b
 *                         /
 *                        z
 *
 * @param tree
 * @param node
 * @param p
 */
export function rbInsertRight(tree: TextBuffer, node: TreeNode, p: Piece) {
	let z = new TreeNode(p, NodeColor.Red);
	z.left = SENTINEL;
	z.right = SENTINEL;
	z.parent = SENTINEL;
	z.size_left = 0;
	z.lf_left = 0;

	let x = tree.root;
	if (x === SENTINEL) {
		tree.root = z;
		setNodeColor(z, NodeColor.Black);
	} else if (node.right === SENTINEL) {
		node.right = z;
		z.parent = node;
	} else {
		let nextNode = leftest(node.right);
		nextNode.left = z;
		z.parent = nextNode;
	}

	fixInsert(tree, z);
}

/**
 *      node              node
 *     /  \              /  \
 *    a   b     ---->   a    b
 *                       \
 *                        z
 *
 * @param tree
 * @param node
 * @param p
 */
export function rbInsertLeft(tree: TextBuffer, node: TreeNode, p: Piece) {
	let z = new TreeNode(p, NodeColor.Red);
	z.left = SENTINEL;
	z.right = SENTINEL;
	z.parent = SENTINEL;
	z.size_left = 0;
	z.lf_left = 0;

	let x = tree.root;
	if (x === SENTINEL) {
		tree.root = z;
		setNodeColor(z, NodeColor.Black);
	} else if (node.left === SENTINEL) {
		node.left = z;
		z.parent = node;
	} else {
		let prevNode = righttest(node.left); // a
		prevNode.right = z;
		z.parent = prevNode;
	}

	fixInsert(tree, z);
}

export function fixInsert(tree: TextBuffer, x: TreeNode) {
	recomputeMetadata(tree, x);

	while (x !== tree.root && getNodeColor(x.parent) === NodeColor.Red) {
		if (x.parent === x.parent.parent.left) {
			const y = x.parent.parent.right;

			if (getNodeColor(y) === NodeColor.Red) {
				setNodeColor(x.parent, NodeColor.Black);
				setNodeColor(y, NodeColor.Black);
				setNodeColor(x.parent.parent, NodeColor.Red);
				x = x.parent.parent;
			} else {
				if (x === x.parent.right) {
					x = x.parent;
					leftRotate(tree, x);
				}

				setNodeColor(x.parent, NodeColor.Black);
				setNodeColor(x.parent.parent, NodeColor.Red);
				rightRotate(tree, x.parent.parent);
			}
		} else {
			const y = x.parent.parent.left;

			if (getNodeColor(y) === NodeColor.Red) {
				setNodeColor(x.parent, NodeColor.Black);
				setNodeColor(y, NodeColor.Black);
				setNodeColor(x.parent.parent, NodeColor.Red);
				x = x.parent.parent;
			} else {
				if (x === x.parent.left) {
					x = x.parent;
					rightRotate(tree, x);
				}
				setNodeColor(x.parent, NodeColor.Black);
				setNodeColor(x.parent.parent, NodeColor.Red);
				leftRotate(tree, x.parent.parent);
			}
		}
	}

	setNodeColor(tree.root, NodeColor.Black);
}

export function updateMetadata(tree: TextBuffer, x: TreeNode, delta: number, lineFeedCntDelta: number): void {
	// node length change, we need to update the roots of all subtrees containing this node.
	while (x !== tree.root && x !== SENTINEL) {
		if (x.parent.left === x) {
			x.parent.size_left += delta;
			x.parent.lf_left += lineFeedCntDelta;
		}

		x = x.parent;
	}
}

export function recomputeMetadata(tree: TextBuffer, x: TreeNode) {
	let delta = 0;
	let lf_delta = 0;
	if (x === tree.root) {
		return;
	}

	if (delta === 0) {
		// go upwards till the node whose left subtree is changed.
		while (x !== tree.root && x === x.parent.right) {
			x = x.parent;
		}

		if (x === tree.root) {
			// well, it means we add a node to the end (inorder)
			return;
		}

		// x is the node whose right subtree is changed.
		x = x.parent;

		delta = calculateSize(x.left) - x.size_left;
		lf_delta = calculateLF(x.left) - x.lf_left;
		x.size_left += delta;
		x.lf_left += lf_delta;
	}

	// go upwards till root. O(logN)
	while (x !== tree.root && (delta !== 0 || lf_delta !== 0)) {
		if (x.parent.left === x) {
			x.parent.size_left += delta;
			x.parent.lf_left += lf_delta;
		}

		x = x.parent;
	}
}

function calculateSize(node: TreeNode): number {
	if (node === SENTINEL) {
		return 0;
	}

	return node.size_left + node.piece.length + calculateSize(node.right);
}

function calculateLF(node: TreeNode): number {
	if (node === SENTINEL) {
		return 0;
	}

	return node.lf_left + node.piece.lineFeedCnt + calculateLF(node.right);
}

export function rbDelete(tree: TextBuffer, z: TreeNode) {
	let x: TreeNode;
	let y: TreeNode;

	if (z.left === SENTINEL) {
		y = z;
		x = y.right;
	} else if (z.right === SENTINEL) {
		y = z;
		x = y.left;
	} else {
		y = leftest(z.right);
		x = y.right;
	}

	if (y === tree.root) {
		tree.root = x;

		// if x is null, we are removing the only node
		setNodeColor(x, NodeColor.Black);

		z.detach();
		resetSentinel();
		tree.root.parent = SENTINEL;

		return;
	}

	let yWasRed = (getNodeColor(y) === NodeColor.Red);

	if (y === y.parent.left) {
		y.parent.left = x;
	} else {
		y.parent.right = x;
	}

	if (y === z) {
		x.parent = y.parent;
		recomputeMetadata(tree, x);
	} else {
		if (y.parent === z) {
			x.parent = y;
		} else {
			x.parent = y.parent;
		}

		// as we make changes to x's hierarchy, update size_left of subtree first
		recomputeMetadata(tree, x);

		y.left = z.left;
		y.right = z.right;
		y.parent = z.parent;
		setNodeColor(y, getNodeColor(z));

		if (z === tree.root) {
			tree.root = y;
		} else {
			if (z === z.parent.left) {
				z.parent.left = y;
			} else {
				z.parent.right = y;
			}
		}

		if (y.left !== SENTINEL) {
			y.left.parent = y;
		}
		if (y.right !== SENTINEL) {
			y.right.parent = y;
		}
		// update metadata
		// we replace z with y, so in this sub tree, the length change is z.item.length
		y.size_left = z.size_left;
		y.lf_left = z.lf_left;
		recomputeMetadata(tree, y);
	}

	z.detach();

	if (x.parent.left === x) {
		let newSizeLeft = calculateSize(x);
		let newLFLeft = calculateLF(x);
		if (newSizeLeft !== x.parent.size_left || newLFLeft !== x.parent.lf_left) {
			let delta = newSizeLeft - x.parent.size_left;
			let lf_delta = newLFLeft - x.parent.lf_left;
			x.parent.size_left = newSizeLeft;
			x.parent.lf_left = newLFLeft;
			updateMetadata(tree, x.parent, delta, lf_delta);
		}
	}

	recomputeMetadata(tree, x.parent);

	if (yWasRed) {
		resetSentinel();
		return;
	}

	// RB-DELETE-FIXUP
	let w: TreeNode;
	while (x !== tree.root && getNodeColor(x) === NodeColor.Black) {
		if (x === x.parent.left) {
			w = x.parent.right;

			if (getNodeColor(w) === NodeColor.Red) {
				setNodeColor(w, NodeColor.Black);
				setNodeColor(x.parent, NodeColor.Red);
				leftRotate(tree, x.parent);
				w = x.parent.right;
			}

			if (getNodeColor(w.left) === NodeColor.Black && getNodeColor(w.right) === NodeColor.Black) {
				setNodeColor(w, NodeColor.Red);
				x = x.parent;
			} else {
				if (getNodeColor(w.right) === NodeColor.Black) {
					setNodeColor(w.left, NodeColor.Black);
					setNodeColor(w, NodeColor.Red);
					rightRotate(tree, w);
					w = x.parent.right;
				}

				setNodeColor(w, getNodeColor(x.parent));
				setNodeColor(x.parent, NodeColor.Black);
				setNodeColor(w.right, NodeColor.Black);
				leftRotate(tree, x.parent);
				x = tree.root;
			}
		} else {
			w = x.parent.left;

			if (getNodeColor(w) === NodeColor.Red) {
				setNodeColor(w, NodeColor.Black);
				setNodeColor(x.parent, NodeColor.Red);
				rightRotate(tree, x.parent);
				w = x.parent.left;
			}

			if (getNodeColor(w.left) === NodeColor.Black && getNodeColor(w.right) === NodeColor.Black) {
				setNodeColor(w, NodeColor.Red);
				x = x.parent;

			} else {
				if (getNodeColor(w.left) === NodeColor.Black) {
					setNodeColor(w.right, NodeColor.Black);
					setNodeColor(w, NodeColor.Red);
					leftRotate(tree, w);
					w = x.parent.left;
				}

				setNodeColor(w, getNodeColor(x.parent));
				setNodeColor(x.parent, NodeColor.Black);
				setNodeColor(w.left, NodeColor.Black);
				rightRotate(tree, x.parent);
				x = tree.root;
			}
		}
	}
	setNodeColor(x, NodeColor.Black);
	resetSentinel();
}

function resetSentinel(): void {
	SENTINEL.parent = SENTINEL;
}

function debug(str: string, indent: number = 0) {
	let output = '';
	for (let i = 0; i < indent; i++) {
		output += '  ';
	}

	output += str;
	console.log(output);
}

export class TreeNode {
	parent: TreeNode;
	left: TreeNode;
	right: TreeNode;
	color: NodeColor;

	// Piece
	piece: Piece;
	size_left: number; // size of the left subtree (not inorder)
	lf_left: number; // line feeds cnt in the left subtree (not in order)

	constructor(piece: Piece, color: NodeColor) {
		this.piece = piece;
		this.color = color;
		this.size_left = 0;
		this.lf_left = 0;
		this.parent = null;
		this.left = null;
		this.right = null;
	}

	public next(): TreeNode {
		if (this.right !== SENTINEL) {
			return leftest(this.right);
		}

		let node: TreeNode = this;

		while (node.parent !== SENTINEL) {
			if (node.parent.left === node) {
				break;
			}

			node = node.parent;
		}

		if (node.parent === SENTINEL) {
			// root
			// if (node.right === SENTINEL) {
			return SENTINEL;
			// }
			// return leftest(node.right);
		} else {
			return node.parent;
		}
	}

	public prev(): TreeNode {
		if (this.left !== SENTINEL) {
			return righttest(this.left);
		}

		let node: TreeNode = this;

		while (node.parent !== SENTINEL) {
			if (node.parent.right === node) {
				break;
			}

			node = node.parent;
		}

		if (node.parent === SENTINEL) {
			// root
			// if (node.left === SENTINEL) {
			return SENTINEL;
			// }
			// return righttest(node.left);
		} else {
			return node.parent;
		}
	}

	public size(): number {
		if (this === SENTINEL) {
			return 0;
		}
		this.size_left = this.left.size();
		return this.size_left + this.piece.length + this.right.size();
	}


	public validate() {
		if (this === SENTINEL) {
			return;
		}

		this.left.validate();
		this.right.validate();
		let left = calculateSize(this.left);
		if (left !== this.size_left) {
			// console.debug();
			error.sizeLeft = true;
		}
	}

	public print(indent: number = 0) {
		if (!this.piece) {
			return;
		}

		debug(`${this.color === NodeColor.Red ? 'R' : 'B'} (${this.piece.isOriginalBuffer ? 'Original' : 'Changed'}, left: ${this.size_left}, offsetInBuf: ${this.piece.offset}, len: ${this.piece.length})`, indent);
		if (this.left && this.left.piece) {
			debug('--- left tree:', indent);
			++indent;
			this.left.print(indent);
			--indent;
		}

		if (this.right && this.right.piece) {
			debug('--- right tree:', indent);
			++indent;
			this.right.print(indent);
			--indent;
		}
	}

	public detach(): void {
		this.parent = null;
		this.left = null;
		this.right = null;
	}
}

export const SENTINEL: TreeNode = new TreeNode(null, NodeColor.Black);
SENTINEL.parent = SENTINEL;
SENTINEL.left = SENTINEL;
SENTINEL.right = SENTINEL;
setNodeColor(SENTINEL, NodeColor.Black);

export interface BufferCursor {
	/**
	 * Piece Index
	 */
	node: TreeNode;
	/**
	 * remainer in current piece.
	*/
	remainder: number;
}

export class Piece {
	isOriginalBuffer: boolean;
	offset: number;
	length: number; // size of current piece

	lineFeedCnt: number;
	lineStarts: PrefixSumComputer;

	constructor(isOriginalBuffer: boolean, offset: number, length: number, lineFeedCnt: number, lineLengthsVal: Uint32Array) {
		this.isOriginalBuffer = isOriginalBuffer;
		this.offset = offset;
		this.length = length;
		this.lineFeedCnt = lineFeedCnt;
		this.lineStarts = null;

		if (lineLengthsVal) {
			let newVal = new Uint32Array(lineLengthsVal.length);
			newVal.set(lineLengthsVal);
			this.lineStarts = new PrefixSumComputer(newVal);
		}
	}
}

export class TextBuffer {
	private _BOM: string;
	private _EOL: string;
	private _mightContainRTL: boolean;
	private _mightContainNonBasicASCII: boolean;

	private _originalBuffer: string;
	private _changeBuffer: string;
	root: TreeNode;

	constructor(textSource: ITextSource) {
		let rawBuffer = <IRawPTBuffer>textSource.lines;
		this._originalBuffer = rawBuffer.text;
		this._changeBuffer = '';
		this.root = SENTINEL;
		this._BOM = textSource.BOM;
		this._EOL = textSource.EOL;
		this._mightContainNonBasicASCII = !textSource.isBasicASCII;
		this._mightContainRTL = textSource.containsRTL;

		if (this._originalBuffer.length > 0) {
			let { lineFeedCount, lineLengths } = this.udpateLFCount(this._originalBuffer);
			let piece = new Piece(true, 0, this._originalBuffer.length, lineFeedCount, lineLengths);
			rbInsertLeft(this, null, piece);
		}
	}
	// constructor(originalBuffer: string, size?: number) {
	// 	this._originalBuffer = originalBuffer;
	// 	this._changeBuffer = '';
	// 	this.root = SENTINEL;
	// 	this._BOM = '';
	// 	this._EOL = '';
	// 	this._mightContainNonBasicASCII = false;
	// 	this._mightContainRTL = false;

	// 	if (originalBuffer.length > 0) {
	// 		let { lineFeedCount, lineLengths } = this.udpateLFCount(originalBuffer);
	// 		let piece = new Piece(true, 0, originalBuffer.length, lineFeedCount, lineLengths);
	// 		rbInsertLeft(this, null, piece);
	// 	}
	// }

	public equals(other: ITextSource): boolean {
		if (this._BOM !== other.BOM) {
			return false;
		}
		if (this._EOL !== other.EOL) {
			return false;
		}
		if (this.getLinesContent() !== (<IRawPTBuffer>other.lines).text) {
			return false;
		}
		return true;
	}

	public mightContainRTL(): boolean {
		return this._mightContainRTL;
	}

	public mightContainNonBasicASCII(): boolean {
		return this._mightContainNonBasicASCII;
	}

	public getBOM(): string {
		return this._BOM;
	}

	public getEOL(): string {
		return this._EOL;
	}

	public setEOL(newEOL: string): void {
		this._EOL = newEOL;
		// this._constructLineStarts();
	}

	public insert(value: string, offset: number): void {
		// todo, validate value and offset.

		if (this.root !== SENTINEL) {
			let { node, remainder } = this.nodeAt(offset);

			// if (!node) {
			// 	this.nodeAt(offset);
			// 	throw('we are in trouble');
			// }
			let insertPos = node.piece.lineStarts.getIndexOf(remainder);

			let nodeOffsetInDocument = this.offsetOfNode(node);
			const startOffset = this._changeBuffer.length;
			this._changeBuffer += value;

			if (!node.piece.isOriginalBuffer && (node.piece.offset + node.piece.length === this._changeBuffer.length - value.length) && (nodeOffsetInDocument + node.piece.length === offset)) {
				// append content to this node
				// we don't want to keep adding node when users simply type in sequence.
				node.piece.length += value.length;
				const { lineFeedCount, lineLengths } = this.udpateLFCount(value);
				node.piece.lineFeedCnt += lineFeedCount;
				if (lineLengths) {
					let lineStarts = node.piece.lineStarts;
					lineStarts.changeValue(lineStarts.values.length - 1, lineStarts.values[lineStarts.values.length - 1] + lineLengths[0]);
					lineStarts.insertValues(lineStarts.values.length, lineLengths.slice(1));
				}
				updateMetadata(this, node, value.length, lineFeedCount);
			} else {
				const { lineFeedCount, lineLengths } = this.udpateLFCount(value);
				let newPiece: Piece = new Piece(false, startOffset, value.length, lineFeedCount, lineLengths);

				if (nodeOffsetInDocument === offset) {
					// we are inserting content to the beginning of node
					// insert to its left
					rbInsertLeft(this, node, newPiece);
				} else if (nodeOffsetInDocument + node.piece.length > offset) {
					// we need to split node.
					// create the new piece first as we are reading current node info before mdofiying it.
					let newRightPiece = new Piece(node.piece.isOriginalBuffer, node.piece.offset + offset - nodeOffsetInDocument, nodeOffsetInDocument + node.piece.length - offset, node.piece.lineFeedCnt - insertPos.index, node.piece.lineStarts.values);
					newRightPiece.lineStarts.changeValue(insertPos.index, newRightPiece.lineStarts.values[insertPos.index] - insertPos.remainder);

					if (insertPos.index > 0) {
						newRightPiece.lineStarts.removeValues(0, insertPos.index);
					}

					// update node metadata
					node.piece.length -= newRightPiece.length;
					let lf_delta = insertPos.index - node.piece.lineFeedCnt;
					node.piece.lineFeedCnt = insertPos.index;
					node.piece.lineStarts.removeValues(insertPos.index + 1, node.piece.lineStarts.values.length - insertPos.index - 1);
					node.piece.lineStarts.changeValue(insertPos.index, insertPos.remainder);


					updateMetadata(this, node, -newRightPiece.length, lf_delta);

					rbInsertRight(this, node, newRightPiece);
					rbInsertRight(this, node, newPiece);
				} else {
					rbInsertRight(this, node, newPiece);
				}
			}
		} else {
			// insert new node
			const startOffset = this._changeBuffer.length;
			this._changeBuffer += value;
			const { lineFeedCount, lineLengths } = this.udpateLFCount(value);
			let piece = new Piece(false, startOffset, value.length, lineFeedCount, lineLengths);

			rbInsertLeft(this, null, piece);
		}
		// this.validate();
		// this.print();
	}

	public delete(offset: number, cnt: number): void {
		if (this.root !== SENTINEL) {
			let startPosition = this.nodeAt(offset);
			let endPosition = this.nodeAt(offset + cnt);
			let startNode = startPosition.node;
			let endNode = endPosition.node;

			let length = startNode.piece.length;
			let startNodeOffsetInDocument = this.offsetOfNode(startNode);
			let splitPos = startNode.piece.lineStarts.getIndexOf(offset - startNodeOffsetInDocument);

			if (startNode === endNode) {
				// deletion falls into one node.
				let endSplitPos = startNode.piece.lineStarts.getIndexOf(offset - startNodeOffsetInDocument + cnt);

				if (startNodeOffsetInDocument === offset) {
					if (cnt === length) {
						rbDelete(this, startNode);
						return;
					}

					// if (cnt > length) {
					// 	throw('not possible, it is crazy');
					// }

					// delete head
					startNode.piece.length -= cnt;
					startNode.piece.offset += cnt;
					startNode.piece.lineFeedCnt -= endSplitPos.index;
					startNode.piece.lineStarts.changeValue(endSplitPos.index, startNode.piece.lineStarts.values[endSplitPos.index] - endSplitPos.remainder);

					if (endSplitPos.index > 0) {
						startNode.piece.lineStarts.removeValues(0, endSplitPos.index);
					}
					updateMetadata(this, startNode, -cnt, -endSplitPos.index);
					return;
				}

				if (startNodeOffsetInDocument + length === offset + cnt) {
					// delete tail
					startNode.piece.length -= cnt;
					let lf_delta = splitPos.index - startNode.piece.lineFeedCnt;
					startNode.piece.lineFeedCnt = splitPos.index;
					startNode.piece.lineStarts.removeValues(splitPos.index + 1, startNode.piece.lineStarts.values.length - splitPos.index - 1);
					startNode.piece.lineStarts.changeValue(splitPos.index, splitPos.remainder);
					updateMetadata(this, startNode, -cnt, lf_delta);
					return;
				}

				// delete content in the middle
				// this node will be splitted to nodes

				// read operations first
				let oldLineLengthsVal = startNode.piece.lineStarts.values;

				startNode.piece.length = offset - startNodeOffsetInDocument;
				let lf_delta = splitPos.index - startNode.piece.lineFeedCnt;
				startNode.piece.lineFeedCnt = splitPos.index;
				startNode.piece.lineStarts = new PrefixSumComputer(oldLineLengthsVal.slice(0, splitPos.index + 1));
				startNode.piece.lineStarts.changeValue(splitPos.index, splitPos.remainder);
				updateMetadata(this, startNode, -(startNodeOffsetInDocument + length - offset), lf_delta);

				let newPieceLength = startNodeOffsetInDocument + length - offset - cnt;
				if (newPieceLength <= 0) {
					return;
				}

				let newPiece: Piece = new Piece(
					startNode.piece.isOriginalBuffer,
					offset + cnt - startNodeOffsetInDocument + startNode.piece.offset,
					newPieceLength,
					oldLineLengthsVal.length - endSplitPos.index - 1,
					oldLineLengthsVal.slice(endSplitPos.index)
				);
				newPiece.lineStarts.changeValue(0, newPiece.lineStarts.values[0] - endSplitPos.remainder);

				rbInsertRight(this, startNode, newPiece);
				// this.validate();
				return;
			}

			// unluckily, we need to delete/modify more than one node.
			// perform read operations before any write operation.
			let endNodeOffsetInDocument = this.offsetOfNode(endNode);

			// update firstTouchedNode
			startNode.piece.length = offset - startNodeOffsetInDocument;
			let lf_delta = splitPos.index - startNode.piece.lineFeedCnt;
			startNode.piece.lineFeedCnt = splitPos.index;
			startNode.piece.lineStarts.removeValues(splitPos.index + 1, startNode.piece.lineStarts.values.length - splitPos.index - 1);
			startNode.piece.lineStarts.changeValue(splitPos.index, splitPos.remainder);
			updateMetadata(this, startNode, -(startNodeOffsetInDocument + length - offset), lf_delta);

			// update lastTouchedNode
			endNode.piece.length -= offset + cnt - endNodeOffsetInDocument;
			endNode.piece.offset += offset + cnt - endNodeOffsetInDocument;
			let endSplitPos = endNode.piece.lineStarts.getIndexOf(offset - endNodeOffsetInDocument + cnt);
			endNode.piece.lineFeedCnt -= endSplitPos.index;
			endNode.piece.lineStarts.changeValue(endSplitPos.index, endNode.piece.lineStarts.values[endSplitPos.index] - endSplitPos.remainder);
			endNode.piece.lineStarts.removeValues(0, endSplitPos.index);
			updateMetadata(this, endNode, -(offset + cnt - endNodeOffsetInDocument), -endSplitPos.index);

			let nodesToDel = [];
			if (endNode.piece.length === 0) {
				nodesToDel.push(endNode);
			}


			let secondNode = startNode.next();
			if (secondNode !== endNode) {
				for (let node = secondNode; node !== SENTINEL && node !== endNode; node = node.next()) {
					nodesToDel.push(node);
				}
			}

			for (let i = 0; i < nodesToDel.length; i++) {
				rbDelete(this, nodesToDel[i]);
			}
		}

		// this.validate();
	}

	public _applyEdits(rawOperations: editorCommon.IIdentifiedSingleEditOperation[], recordTrimAutoWhitespace: boolean): ApplyEditResult {
		let mightContainRTL = this._mightContainRTL;
		let mightContainNonBasicASCII = this._mightContainNonBasicASCII;
		let canReduceOperations = true;

		let operations: IValidatedEditOperation[] = [];
		for (let i = 0; i < rawOperations.length; i++) {
			let op = rawOperations[i];
			if (canReduceOperations && op._isTracked) {
				canReduceOperations = false;
			}
			let validatedRange = op.range;
			if (!mightContainRTL && op.text) {
				// check if the new inserted text contains RTL
				mightContainRTL = strings.containsRTL(op.text);
			}
			if (!mightContainNonBasicASCII && op.text) {
				mightContainNonBasicASCII = !strings.isBasicASCII(op.text);
			}
			operations[i] = {
				sortIndex: i,
				identifier: op.identifier,
				range: validatedRange,
				rangeOffset: this.getOffsetAt(validatedRange.getStartPosition()),
				rangeLength: this.getValueLengthInRange(validatedRange),
				lines: op.text ? op.text.split(/\r\n|\r|\n/) : null,
				forceMoveMarkers: op.forceMoveMarkers,
				isAutoWhitespaceEdit: op.isAutoWhitespaceEdit || false
			};
		}

		// Sort operations ascending
		operations.sort(TextBuffer._sortOpsAscending);

		for (let i = 0, count = operations.length - 1; i < count; i++) {
			let rangeEnd = operations[i].range.getEndPosition();
			let nextRangeStart = operations[i + 1].range.getStartPosition();

			if (nextRangeStart.isBefore(rangeEnd)) {
				// overlapping ranges
				throw new Error('Overlapping ranges are not allowed!');
			}
		}

		if (canReduceOperations) {
			// operations = this._reduceOperations(operations);
		}

		// Delta encode operations
		let reverseRanges = TextBuffer._getInverseEditRanges(operations);
		let newTrimAutoWhitespaceCandidates: { lineNumber: number, oldContent: string }[] = [];

		for (let i = 0; i < operations.length; i++) {
			let op = operations[i];
			let reverseRange = reverseRanges[i];

			if (recordTrimAutoWhitespace && op.isAutoWhitespaceEdit && op.range.isEmpty()) {
				// Record already the future line numbers that might be auto whitespace removal candidates on next edit
				for (let lineNumber = reverseRange.startLineNumber; lineNumber <= reverseRange.endLineNumber; lineNumber++) {
					let currentLineContent = '';
					if (lineNumber === reverseRange.startLineNumber) {
						currentLineContent = this.getLineContent(op.range.startLineNumber);
						if (strings.firstNonWhitespaceIndex(currentLineContent) !== -1) {
							continue;
						}
					}
					newTrimAutoWhitespaceCandidates.push({ lineNumber: lineNumber, oldContent: currentLineContent });
				}
			}
		}

		let reverseOperations: editorCommon.IIdentifiedSingleEditOperation[] = [];
		for (let i = 0; i < operations.length; i++) {
			let op = operations[i];
			let reverseRange = reverseRanges[i];

			reverseOperations[i] = {
				identifier: op.identifier,
				range: reverseRange,
				text: this.getValueInRange(op.range),
				forceMoveMarkers: op.forceMoveMarkers
			};
		}

		this._mightContainRTL = mightContainRTL;
		this._mightContainNonBasicASCII = mightContainNonBasicASCII;

		const [rawContentChanges, contentChanges] = this._doApplyEdits(operations);

		let trimAutoWhitespaceLineNumbers: number[] = null;
		if (recordTrimAutoWhitespace && newTrimAutoWhitespaceCandidates.length > 0) {
			// sort line numbers auto whitespace removal candidates for next edit descending
			newTrimAutoWhitespaceCandidates.sort((a, b) => b.lineNumber - a.lineNumber);

			trimAutoWhitespaceLineNumbers = [];
			for (let i = 0, len = newTrimAutoWhitespaceCandidates.length; i < len; i++) {
				let lineNumber = newTrimAutoWhitespaceCandidates[i].lineNumber;
				if (i > 0 && newTrimAutoWhitespaceCandidates[i - 1].lineNumber === lineNumber) {
					// Do not have the same line number twice
					continue;
				}

				let prevContent = newTrimAutoWhitespaceCandidates[i].oldContent;
				let lineContent = this.getLineContent(lineNumber);

				if (lineContent.length === 0 || lineContent === prevContent || strings.firstNonWhitespaceIndex(lineContent) !== -1) {
					continue;
				}

				trimAutoWhitespaceLineNumbers.push(lineNumber);
			}
		}

		return new ApplyEditResult(
			reverseOperations,
			rawContentChanges,
			contentChanges,
			trimAutoWhitespaceLineNumbers
		);
	}

	private _doApplyEdits(operations: IValidatedEditOperation[]): [ModelRawChange[], IInternalModelContentChange[]] {
		operations.sort(TextBuffer._sortOpsDescending);

		let rawContentChanges: ModelRawChange[] = [];
		let contentChanges: IInternalModelContentChange[] = [];

		// operations are from bottom to top
		for (let i = 0; i < operations.length; i++) {
			let op = operations[i];

			const startLineNumber = op.range.startLineNumber;
			const startColumn = op.range.startColumn;
			const endLineNumber = op.range.endLineNumber;
			const endColumn = op.range.endColumn;

			if (startLineNumber === endLineNumber && startColumn === endColumn && (!op.lines || op.lines.length === 0)) {
				// no-op
				continue;
			}

			const deletingLinesCnt = endLineNumber - startLineNumber;
			const insertingLinesCnt = (op.lines ? op.lines.length - 1 : 0);
			const editingLinesCnt = Math.min(deletingLinesCnt, insertingLinesCnt);

			const text = (op.lines ? op.lines.join(this.getEOL()) : '');

			if (text) {
				// replacement
				this.delete(op.rangeOffset, op.rangeLength);
				this.insert(text, op.rangeOffset);

			} else {
				// deletion
				this.delete(op.rangeOffset, op.rangeLength);
			}

			for (let j = startLineNumber; j <= startLineNumber + editingLinesCnt; j++) {
				rawContentChanges.push(
					new ModelRawLineChanged(j, this.getLineContent(j))
				);
			}

			if (editingLinesCnt < deletingLinesCnt) {
				rawContentChanges.push(
					new ModelRawLinesDeleted(startLineNumber + editingLinesCnt + 1, endLineNumber)
				);
			}

			if (editingLinesCnt < insertingLinesCnt) {
				let newLinesContent: string[] = [];
				for (let j = editingLinesCnt + 1; j <= insertingLinesCnt; j++) {
					newLinesContent.push(op.lines[j]);
				}

				newLinesContent[newLinesContent.length - 1] = this.getLineContent(startLineNumber + insertingLinesCnt - 1);

				rawContentChanges.push(
					new ModelRawLinesInserted(startLineNumber + editingLinesCnt + 1, startLineNumber + insertingLinesCnt, newLinesContent.join('\n'))
				);
			}

			const contentChangeRange = new Range(startLineNumber, startColumn, endLineNumber, endColumn);
			contentChanges.push({
				range: contentChangeRange,
				rangeLength: op.rangeLength,
				text: text,
				lines: op.lines,
				rangeOffset: op.rangeOffset,
				forceMoveMarkers: op.forceMoveMarkers
			});
		}
		return [rawContentChanges, contentChanges];
	}

	public getLinesContent() {
		return this.getContentOfSubTree(this.root);
	}

	public getLineCount(): number {
		let x = this.root;

		let ret = 1;
		while (x !== SENTINEL) {
			ret += x.lf_left + x.piece.lineFeedCnt;
			x = x.right;
		}

		return ret;
	}

	public getValueInRange(range: Range, eol: editorCommon.EndOfLinePreference = editorCommon.EndOfLinePreference.TextDefined): string {
		// todo, validate range.
		if (range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn) {
			return '';
		}

		let startPosition = this.nodeAt2(new Position(range.startLineNumber, range.startColumn));
		let endPosition = this.nodeAt2(new Position(range.endLineNumber, range.endColumn));

		if (startPosition.node === endPosition.node) {
			let node = startPosition.node;
			let buffer = node.piece.isOriginalBuffer ? this._originalBuffer : this._changeBuffer;
			return buffer.substring(node.piece.offset + startPosition.remainder, node.piece.offset + endPosition.remainder);
		}


		let x = startPosition.node;
		let buffer = x.piece.isOriginalBuffer ? this._originalBuffer : this._changeBuffer;
		let ret = buffer.substring(x.piece.offset + startPosition.remainder, x.piece.offset + x.piece.length);

		x = x.next();
		while (x !== SENTINEL) {
			let buffer = x.piece.isOriginalBuffer ? this._originalBuffer : this._changeBuffer;

			if (x === endPosition.node) {
				ret += buffer.substring(x.piece.offset, x.piece.offset + endPosition.remainder);
				break;
			} else {
				ret += buffer.substr(x.piece.offset, x.piece.length);
			}

			x = x.next();
		}

		return ret;
	}

	public getValueLengthInRange(range: Range, eol: editorCommon.EndOfLinePreference = editorCommon.EndOfLinePreference.TextDefined): number {
		if (range.isEmpty()) {
			return 0;
		}

		if (range.startLineNumber === range.endLineNumber) {
			return (range.endColumn - range.startColumn);
		}

		let startOffset = this.getOffsetAt(new Position(range.startLineNumber, range.startColumn));
		let endOffset = this.getOffsetAt(new Position(range.endLineNumber, range.endColumn));
		return endOffset - startOffset;
	}

	public getLineContent(lineNumber: number): string {
		let x = this.root;

		let ret = '';
		while (x !== SENTINEL) {
			if (x.left !== SENTINEL && x.lf_left >= lineNumber - 1) {
				x = x.left;
			} else if (x.lf_left + x.piece.lineFeedCnt > lineNumber - 1) {
				let prevAccumualtedValue = x.piece.lineStarts.getAccumulatedValue(lineNumber - x.lf_left - 2);
				let accumualtedValue = x.piece.lineStarts.getAccumulatedValue(lineNumber - x.lf_left - 1);
				let buffer = x.piece.isOriginalBuffer ? this._originalBuffer : this._changeBuffer;

				return buffer.substring(x.piece.offset + prevAccumualtedValue, x.piece.offset + accumualtedValue);
			} else if (x.lf_left + x.piece.lineFeedCnt === lineNumber - 1) {
				let prevAccumualtedValue = x.piece.lineStarts.getAccumulatedValue(lineNumber - x.lf_left - 2);
				let buffer = x.piece.isOriginalBuffer ? this._originalBuffer : this._changeBuffer;

				ret = buffer.substring(x.piece.offset + prevAccumualtedValue, x.piece.offset + x.piece.length);
				break;
			} else {
				lineNumber -= x.lf_left + x.piece.lineFeedCnt;
				x = x.right;
			}
		}

		// if (x === SENTINEL) {
		// 	throw('not possible');
		// }

		// search in order, to find the node contains end column
		x = x.next();
		while (x !== SENTINEL) {
			let buffer = x.piece.isOriginalBuffer ? this._originalBuffer : this._changeBuffer;

			if (x.piece.lineFeedCnt > 0) {
				let accumualtedValue = x.piece.lineStarts.getAccumulatedValue(0);

				ret += buffer.substring(x.piece.offset, x.piece.offset + accumualtedValue);
				return ret;
			} else {
				ret += buffer.substr(x.piece.offset, x.piece.length);
			}

			x = x.next();
		}

		return ret;

	}

	public getLineCharCode(lineNumber: number, index: number): number {
		return this.getLineContent(lineNumber).charCodeAt(index);
	}

	public getLineLength(lineNumber: number): number {
		return this.getLineContent(lineNumber).length;
	}

	public getLineMinColumn(lineNumber: number): number {
		return 1;
	}

	public getLineMaxColumn(lineNumber: number): number {
		return this.getLineLength(lineNumber) + 1;
	}

	public getLineFirstNonWhitespaceColumn(lineNumber: number): number {
		const result = strings.firstNonWhitespaceIndex(this.getLineContent(lineNumber));
		if (result === -1) {
			return 0;
		}
		return result + 1;
	}

	public getLineLastNonWhitespaceColumn(lineNumber: number): number {
		const result = strings.lastNonWhitespaceIndex(this.getLineContent(lineNumber));
		if (result === -1) {
			return 0;
		}
		return result + 2;
	}

	public getOffsetAt(position: Position): number {
		return this.getOffsetAt2(position.lineNumber, position.column);
	}

	public getOffsetAt2(lineNumber: number, column: number): number {
		let leftLen = 0; // inorder

		let x = this.root;

		while (x !== SENTINEL) {
			if (x.left !== SENTINEL && x.lf_left + 1 >= lineNumber) {
				x = x.left;
			} else if (x.lf_left + x.piece.lineFeedCnt + 1 >= lineNumber) {
				leftLen += x.size_left;
				// lineNumber >= 2
				let accumualtedValInCurrentIndex = x.piece.lineStarts.getAccumulatedValue(lineNumber - x.lf_left - 2);
				return leftLen += accumualtedValInCurrentIndex + column - 1;
			} else {
				lineNumber -= x.lf_left + x.piece.lineFeedCnt;
				leftLen += x.size_left + x.piece.length;
				x = x.right;
			}
		}

		return leftLen;
	}

	public getPositionAt(offset: number): Position {
		let x = this.root;
		let lfCnt = 0;

		while (x !== SENTINEL) {
			if (x.size_left !== 0 && x.size_left >= offset) {
				x = x.left;
			} else if (x.size_left + x.piece.length >= offset) {
				let out = x.piece.lineStarts.getIndexOf(offset - x.size_left);

				let column = 0;

				if (out.index === 0) {
					let prev = x.prev();

					if (prev !== SENTINEL) {
						let lineLens = prev.piece.lineStarts.values;
						column += lineLens[lineLens.length - 1];
					}
				}

				lfCnt += x.lf_left + out.index;
				return new Position(lfCnt + 1, column + out.remainder + 1);
			} else {
				offset -= x.size_left + x.piece.length;
				lfCnt += x.lf_left + x.piece.lineFeedCnt;
				x = x.right;
			}
		}

		return null;
	}

	public getRangeAt(start: number, end: number): Range {
		const startPosition = this.getPositionAt(start);
		const endPosition = this.getPositionAt(end);
		return new Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column);
	}

	print() {
		if (this.root) {
			this.root.print();
		}
	}

	validate() {
		this.root.validate();
	}


	/**
	 *
	 * @param tree
	 * @param offset 0 based.
	 * TODO: return BufferCursor
	 */
	nodeAt(offset: number): BufferCursor {
		let x = this.root;

		while (x !== SENTINEL) {
			if (x.size_left > offset) {
				x = x.left;
			} else if (x.size_left + x.piece.length >= offset) {
				return {
					node: x,
					remainder: offset - x.size_left
				};
			} else {
				offset -= x.size_left + x.piece.length;
				x = x.right;
			}
		}

		return null;
	}

	nodeAt2(position: Position): BufferCursor {
		let x = this.root;
		let lineNumber = position.lineNumber;
		let column = position.column;

		while (x !== SENTINEL) {
			if (x.left !== SENTINEL && x.lf_left >= lineNumber - 1) {
				x = x.left;
			} else if (x.lf_left + x.piece.lineFeedCnt > lineNumber - 1) {
				let prevAccumualtedValue = x.piece.lineStarts.getAccumulatedValue(lineNumber - x.lf_left - 2);
				let accumualtedValue = x.piece.lineStarts.getAccumulatedValue(lineNumber - x.lf_left - 1);

				return {
					node: x,
					remainder: Math.min(prevAccumualtedValue + column - 1, accumualtedValue)
				};
			} else if (x.lf_left + x.piece.lineFeedCnt === lineNumber - 1) {
				let prevAccumualtedValue = x.piece.lineStarts.getAccumulatedValue(lineNumber - x.lf_left - 2);
				if (prevAccumualtedValue + column - 1 <= x.piece.length) {
					return {
						node: x,
						remainder: prevAccumualtedValue + column - 1
					};
				} else {
					column -= x.piece.length - prevAccumualtedValue;
					break;
				}
			} else {
				lineNumber -= x.lf_left + x.piece.lineFeedCnt;
				x = x.right;
			}
		}

		// if (x === SENTINEL) {
		// 	throw('not possible');
		// }

		// search in order, to find the node contains position.column
		x = x.next();
		while (x !== SENTINEL) {

			if (x.piece.lineFeedCnt > 0) {
				let accumualtedValue = x.piece.lineStarts.getAccumulatedValue(0);
				return {
					node: x,
					remainder: Math.min(column - 1, accumualtedValue)
				};
			} else {
				if (x.piece.length >= column - 1) {
					return {
						node: x,
						remainder: column - 1
					};
				} else {
					column -= x.piece.length;
				}
			}

			x = x.next();
		}

		return null;
	}

	offsetOfNode(node: TreeNode): number {
		if (!node) {
			return 0;
		}
		let pos = node.size_left;
		while (node !== this.root) {
			if (node.parent.right === node) {
				pos += node.parent.size_left + node.parent.piece.length;
			}

			node = node.parent;
		}

		return pos;
	}

	/**
	 * Assumes `operations` are validated and sorted ascending
	 */
	public static _getInverseEditRanges(operations: IValidatedEditOperation[]): Range[] {
		let result: Range[] = [];

		let prevOpEndLineNumber: number;
		let prevOpEndColumn: number;
		let prevOp: IValidatedEditOperation = null;
		for (let i = 0, len = operations.length; i < len; i++) {
			let op = operations[i];

			let startLineNumber: number;
			let startColumn: number;

			if (prevOp) {
				if (prevOp.range.endLineNumber === op.range.startLineNumber) {
					startLineNumber = prevOpEndLineNumber;
					startColumn = prevOpEndColumn + (op.range.startColumn - prevOp.range.endColumn);
				} else {
					startLineNumber = prevOpEndLineNumber + (op.range.startLineNumber - prevOp.range.endLineNumber);
					startColumn = op.range.startColumn;
				}
			} else {
				startLineNumber = op.range.startLineNumber;
				startColumn = op.range.startColumn;
			}

			let resultRange: Range;

			if (op.lines && op.lines.length > 0) {
				// the operation inserts something
				let lineCount = op.lines.length;
				let firstLine = op.lines[0];
				let lastLine = op.lines[lineCount - 1];

				if (lineCount === 1) {
					// single line insert
					resultRange = new Range(startLineNumber, startColumn, startLineNumber, startColumn + firstLine.length);
				} else {
					// multi line insert
					resultRange = new Range(startLineNumber, startColumn, startLineNumber + lineCount - 1, lastLine.length + 1);
				}
			} else {
				// There is nothing to insert
				resultRange = new Range(startLineNumber, startColumn, startLineNumber, startColumn);
			}

			prevOpEndLineNumber = resultRange.endLineNumber;
			prevOpEndColumn = resultRange.endColumn;

			result.push(resultRange);
			prevOp = op;
		}

		return result;
	}

	private getContentOfSubTree(node: TreeNode): string {
		if (node === SENTINEL) {
			return '';
		}

		let buffer = node.piece.isOriginalBuffer ? this._originalBuffer : this._changeBuffer;
		let currentContent = buffer.substr(node.piece.offset, node.piece.length);

		return this.getContentOfSubTree(node.left) + currentContent + this.getContentOfSubTree(node.right);
	}

	private udpateLFCount(chunk: string): { lineFeedCount: number, lineLengths: Uint32Array } {
		let chunkLineFeedCnt = 0;
		let lastLineFeedIndex = -1;
		let lineFeedStarts: number[] = [-1];

		while ((lastLineFeedIndex = chunk.indexOf('\n', lastLineFeedIndex + 1)) !== -1) {
			chunkLineFeedCnt++;
			lineFeedStarts.push(lastLineFeedIndex);
		}

		const lineStartValues = new Uint32Array(chunkLineFeedCnt + 1);
		for (let i = 1; i <= chunkLineFeedCnt; i++) {
			lineStartValues[i - 1] = lineFeedStarts[i] - lineFeedStarts[i - 1];
		}

		lineStartValues[chunkLineFeedCnt] = chunk.length - lineFeedStarts[lineFeedStarts.length - 1] - 1;

		return {
			lineFeedCount: chunkLineFeedCnt,
			lineLengths: lineStartValues
		};
	}

	private static _sortOpsAscending(a: IValidatedEditOperation, b: IValidatedEditOperation): number {
		let r = Range.compareRangesUsingEnds(a.range, b.range);
		if (r === 0) {
			return a.sortIndex - b.sortIndex;
		}
		return r;
	}

	private static _sortOpsDescending(a: IValidatedEditOperation, b: IValidatedEditOperation): number {
		let r = Range.compareRangesUsingEnds(a.range, b.range);
		if (r === 0) {
			return b.sortIndex - a.sortIndex;
		}
		return -r;
	}
}