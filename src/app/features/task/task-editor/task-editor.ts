import {ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, model, OnDestroy, OnInit, output, signal, viewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Editor, mergeAttributes, Node} from '@tiptap/core';
import {Selection} from '@tiptap/pm/state'; // Исправление для TS2339: Импорт Selection
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {TextStyle} from '@tiptap/extension-text-style';
import {Color} from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { inject } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';

// ─────────────────────────────────────────────────────────────────
// Custom Notion-style Toggle Extensions (Clean & Stable)
// ─────────────────────────────────────────────────────────────────

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{tag: 'summary'}];
  },
  renderHTML({HTMLAttributes}) {
    return ['summary', mergeAttributes(HTMLAttributes), 0];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.command(({state, tr, dispatch}) => {
        const {selection} = state;
        const {$from, empty} = selection;
        if (!empty || $from.parent.type.name !== this.name) return false;

        const detailsContentPos = $from.after($from.depth);
        if (dispatch) {
          const $pos = state.doc.resolve(detailsContentPos + 1);
          tr.setSelection(Selection.near($pos));
          dispatch(tr);
        }
        return true;
      }),
    };
  },
});

export const DetailsContent = Node.create({
  name: 'detailsContent',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{tag: 'div[data-type="detailsContent"]'}];
  },
  renderHTML({HTMLAttributes}) {
    return ['div', mergeAttributes(HTMLAttributes, {'data-type': 'detailsContent'}), 0];
  },
});

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: (attributes) => (attributes['open'] ? { open: 'true' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details.tiptap-details' }, { tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { class: 'tiptap-details' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('details');
      dom.classList.add('tiptap-details');

      if (node.attrs['open']) {
        dom.setAttribute('open', '');
      }

      // 💡 НАДЕЖНЫЙ ПЕРЕХВАТ КЛИКА С ЗАЩИТОЙ ОТ ВСПЛЫТИЯ
      dom.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Находим ближайшие к месту клика теги
        const closestSummary = target.closest('summary');
        const closestDetails = target.closest('details');

        // Проверяем:
        // 1. Клик был по summary
        // 2. Этот summary принадлежит ИМЕННО ЭТОМУ узлу (closestDetails === dom), а не вложенному
        // 3. Редактор активен
        if (closestSummary && closestDetails === dom && editor.isEditable) {
          e.preventDefault(); // Блокируем нативное открытие

          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (pos !== undefined) {
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                open: !node.attrs['open']
              })
            );
          }
        }
      });

      return {
        dom,
        contentDOM: dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== node.type.name) return false;
          node = updatedNode;

          if (node.attrs['open']) {
            dom.setAttribute('open', '');
          } else {
            dom.removeAttribute('open');
          }
          return true;
        },
      };
    };
  },
});

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-task-editor',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './task-editor.html',
  styleUrls: ['./task-editor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskEditorComponent implements OnInit, OnDestroy {
  private readonly transloco = inject(TranslocoService);

  readonly editable = input<boolean>(false);
  readonly editingInput = input<boolean>(false, {alias: 'editing'});
  readonly editing = computed(() => this.editable() || this.editingInput());

  readonly initialContent = input<string>('');
  readonly value = model<string>('');
  readonly contentChange = output<string>();

  readonly editorContainer = viewChild<ElementRef<HTMLDivElement>>('editorContainer');
  readonly editor = signal<Editor | null>(null);

  private readonly selectionTick = signal<number>(0);

  constructor() {
    effect(() => {
      const isEditable = this.editing();
      const ed = this.editor();
      if (ed && ed.isEditable !== isEditable) {
        ed.setEditable(isEditable);
      }
    });

    effect(() => {
      const content = this.initialContent() || this.value();
      const ed = this.editor();
      if (ed && content !== ed.getHTML() && !ed.isFocused) {
        ed.commands.setContent(content, {emitUpdate: false});
      }
    });
  }

  ngOnInit(): void {
    const container = this.editorContainer()?.nativeElement;
    if (!container) return;

    const initialValue = this.initialContent() || this.value() || '';

    const editorInstance = new Editor({
      element: container,
      editable: this.editing(),
      content: initialValue,
      extensions: [
        StarterKit.configure({
          heading: {levels: [1, 2, 3]},
        }),
        Underline,
        TextStyle,
        Color,
        Highlight.configure({multicolor: true}),
        TextAlign.configure({types: ['heading', 'paragraph']}),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {target: '_blank', rel: 'noopener noreferrer'},
        }),
        Image,
        Details,
        DetailsSummary,
        DetailsContent,
      ],
      onUpdate: ({editor}) => {
        const html = editor.getHTML();
        this.value.set(html);
        this.contentChange.emit(html);
      },
      onSelectionUpdate: () => this.selectionTick.update(v => v + 1),
      onTransaction: () => this.selectionTick.update(v => v + 1)
    });

    this.editor.set(editorInstance);
  }

  ngOnDestroy(): void {
    this.editor()?.destroy();
  }

  // Восстановленные методы, необходимые для task-detail.ts
  public getHTML(): string {
    return this.editor()?.getHTML() || '';
  }

  public setContent(content: string): void {
    this.editor()?.commands.setContent(content, {emitUpdate: false});
  }

  undo(): void {
    this.editor()?.chain().focus().undo().run();
  }

  canUndo(): boolean {
    this.selectionTick();
    return !!this.editor()?.can().undo();
  }

  redo(): void {
    this.editor()?.chain().focus().redo().run();
  }

  canRedo(): boolean {
    this.selectionTick();
    return !!this.editor()?.can().redo();
  }

  toggleBold(): void {
    this.editor()?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor()?.chain().focus().toggleItalic().run();
  }

  toggleUnderline(): void {
    this.editor()?.chain().focus().toggleUnderline().run();
  }

  toggleStrike(): void {
    this.editor()?.chain().focus().toggleStrike().run();
  }

  toggleCode(): void {
    this.editor()?.chain().focus().toggleCode().run();
  }

  toggleHeading(level: 1 | 2 | 3): void {
    this.editor()?.chain().focus().toggleHeading({level}).run();
  }

  setAlign(alignment: 'left' | 'center' | 'right'): void {
    this.editor()?.chain().focus().setTextAlign(alignment).run();
  }

  isAlignActive(alignment: string): boolean {
    this.selectionTick();
    return !!this.editor()?.isActive({textAlign: alignment});
  }

  toggleBulletList(): void {
    this.editor()?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor()?.chain().focus().toggleOrderedList().run();
  }

  indent(): void {
    this.editor()?.chain().focus().sinkListItem('listItem').run();
  }

  canIndent(): boolean {
    this.selectionTick();
    return !!this.editor()?.can().sinkListItem('listItem');
  }

  outdent(): void {
    this.editor()?.chain().focus().liftListItem('listItem').run();
  }

  canOutdent(): boolean {
    this.selectionTick();
    return !!this.editor()?.can().liftListItem('listItem');
  }

  getTextColor(): string {
    this.selectionTick();
    const color = this.editor()?.getAttributes('textStyle')['color'];
    return color || '#000000';
  }

  setTextColor(color: string): void {
    if (color) this.editor()?.chain().focus().setColor(color).run();
  }

  getHighlightColor(): string {
    this.selectionTick();
    const color = this.editor()?.getAttributes('highlight')['color'];
    return color || '#ffff00';
  }

  setHighlightColor(color: string): void {
    if (color) this.editor()?.chain().focus().setHighlight({color}).run();
  }

  toggleBlockquote(): void {
    this.editor()?.chain().focus().toggleBlockquote().run();
  }

  toggleCodeBlock(): void {
    this.editor()?.chain().focus().toggleCodeBlock().run();
  }

  setLink(): void {
    const previousUrl = this.editor()?.getAttributes('link')['href'];
    // ИСПОЛЬЗУЕМ ПЕРЕВОД:
    const url = window.prompt(this.transloco.translate('task.editor.promptLink'), previousUrl);
    if (url === null) return;
    if (url === '') {
      this.editor()?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    this.editor()?.chain().focus().extendMarkRange('link').setLink({href: url}).run();
  }

  setImage(): void {
    // ИСПОЛЬЗУЕМ ПЕРЕВОД:
    const url = window.prompt(this.transloco.translate('task.editor.promptImage'));
    if (url) this.editor()?.chain().focus().setImage({src: url}).run();
  }

  setHR(): void {
    this.editor()?.chain().focus().setHorizontalRule().run();
  }

  clearFormatting(): void {
    this.editor()?.chain().focus().unsetAllMarks().clearNodes().run();
  }

  toggleDetails(): void {
    const ed = this.editor();
    if (!ed) return;

    const {state} = ed;
    const {selection} = state;

    const selectedText = state.doc.textBetween(selection.from, selection.to, ' ').trim();
    // ИСПОЛЬЗУЕМ ПЕРЕВОД ДЛЯ ДЕФОЛТНОГО ТЕКСТА:
    const summaryText = selectedText || this.transloco.translate('task.editor.hiddenList');

    ed.chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: 'details',
        attrs: {open: true},
        content: [
          {
            type: 'detailsSummary',
            content: [{type: 'text', text: summaryText}]
          },
          {
            type: 'detailsContent',
            content: [
              {type: 'paragraph'}
            ]
          }
        ]
      })
      .run();
  }
}
