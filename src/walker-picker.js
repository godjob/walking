// @ts-nocheck
// WalkerPicker: 担当者の選択UI（散歩の準備・散歩の編集・お世話で共通）
//
// 1人1ボタンを横に並べ、画面幅に収まらなければ折り返す。
// 選択ロジックは呼び出し側が持つ（散歩は複数選択、お世話は1人だけ）。
//   selected: 選択中の名前の配列
//   onToggle: タップされた名前を受け取る
//   single:   true なら1人だけ選択（見た目は同じ・役割だけ radio になる）

function WalkerPicker({ walkers, selected, onToggle, single = false }) {
    return React.createElement('div', { className: 'flex flex-wrap gap-2', role: single ? 'radiogroup' : 'group' },
        walkers.map(w => {
            const isSelected = selected.includes(w.name);
            return React.createElement('button', {
                key: w.id,
                type: 'button',
                role: single ? 'radio' : 'checkbox',
                'aria-checked': isSelected ? 'true' : 'false',
                onClick: () => onToggle(w.name),
                className: isSelected
                    ? 'flex-1 min-w-[4.5rem] min-h-[44px] px-2 rounded-lg border-2 font-bold text-sm bg-blue-100 border-blue-500 text-blue-700'
                    : 'flex-1 min-w-[4.5rem] min-h-[44px] px-2 rounded-lg border-2 font-bold text-sm bg-white border-gray-300 text-gray-700'
            }, (isSelected ? '✓ ' : '') + w.name);
        })
    );
}

export { WalkerPicker };
