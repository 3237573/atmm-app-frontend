import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  signal,
  ViewChild,
  inject
} from '@angular/core';
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import {TextStyle} from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import {Details, DetailsSummary, DetailsContent} from '@tiptap/extension-details';

// ═══════════════════════════════════════════════════
// 1. Кастомный ListItem со встроенными Tab / Shift+Tab
// ═══════════════════════════════════════════════════
const TaskListItem = ListItem.extend({
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem('listItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem('listItem'),
    };
  },
});

@Component({
  selector: 'app-task-editor',
  standalone: true,
  templateUrl: './task-editor.html',
  styleUrls: ['./task-editor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer', {read: ElementRef})
  editorContainer!: ElementRef<HTMLDivElement>;

  editor = signal<Editor | undefined>(undefined);
  editing = signal(false);
  loading = signal(true);

  private readonly cdr = inject(ChangeDetectorRef);
  private _initialContent = '';

  @Input() set editable(v: boolean) {
    this.editing.set(v);
    const ed = this.editor();
    if (ed) ed.setEditable(v);
  }

  @Input() set initialContent(val: string) {
    this._initialContent = val;
    if (this.editor()) this.setContent(val);
  }

  get initialContent(): string {
    return this._initialContent;
  }

  ngAfterViewInit(): void {
    if (!this.editorContainer?.nativeElement) return;

    // Замыкание для editorProps.handleKeyDown (editor ещё не создан)
    let editorRef: Editor | undefined;

    const instance = new Editor({
      element: this.editorContainer.nativeElement,

      extensions: [
        // 2. StarterKit БЕЗ списков — подключаем их вручную ниже
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
          listItem: false,
          heading: {levels: [1, 2, 3]},
        }),

        // 3. Явно подключаем списки с кастомным ListItem
        BulletList.configure({itemTypeName: 'listItem'}),
        OrderedList.configure({itemTypeName: 'listItem'}),
        TaskListItem,

        Underline,
        TextAlign.configure({types: ['heading', 'paragraph']}),
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https'
        }),
        Image.configure({allowBase64: true}),

        // 4. TextStyle ОБЯЗАТЕЛЬНО перед Color
        TextStyle,
        Color,

        Highlight.configure({
          multicolor: true,
          HTMLAttributes: {class: 'tiptap-highlight'}
        }),

        Details.configure({
          persist: true,
          HTMLAttributes: {class: 'tiptap-details'}
        }),
        DetailsSummary,
        DetailsContent,
      ],

      content: this.parseContent(this.initialContent),
      editable: this.editing(),

      onTransaction: () => this.cdr.detectChanges(),

      // 5. Fallback: Tab / Shift+Tab на уровне редактора (надёжнее, чем только addKeyboardShortcuts)
      editorProps: {
        handleKeyDown: (view, event) => {
          if (event.key === 'Tab' && editorRef) {
            const handled = event.shiftKey
              ? editorRef.can().liftListItem('listItem') && editorRef.commands.liftListItem('listItem')
              : editorRef.can().sinkListItem('listItem') && editorRef.commands.sinkListItem('listItem');

            if (handled) {
              event.preventDefault();
              return true;
            }
          }
          return false;
        }
      }
    });

    editorRef = instance;
    this.editor.set(instance);
    this.loading.set(false);
  }

  private parseContent(raw: string): any {
    if (!raw) return '';
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  setContent(raw: string): void {
    const ed = this.editor();
    if (!ed) return;
    ed.commands.setContent(this.parseContent(raw));
  }

  getHTML(): string {
    return this.editor()?.getHTML() ?? '';
  }

  getJSON(): string {
    return JSON.stringify(this.editor()?.getJSON() ?? {});
  }

  // ─── Colors ───

  getTextColor(): string {
    const ed = this.editor();
    if (!ed) return '#000000';
    const attrs = ed.getAttributes('textStyle') as Record<string, any>;
    return attrs?.['color'] || '#000000';
  }

  getHighlightColor(): string {
    const ed = this.editor();
    if (!ed) return '#ffff00';
    const attrs = ed.getAttributes('highlight') as Record<string, any>;
    return attrs?.['color'] || '#ffff00';
  }

  setHighlightColor(color: string): void {
    this.editor()?.chain().focus().setHighlight({color}).run();
  }

  // ─── Link & Image ───

  setLink(): void {
    const ed = this.editor();
    if (!ed) return;
    const previousUrl = ed.getAttributes('link')['href'] || '';
    const url = window.prompt('Введите URL ссылки:', previousUrl);
    if (url === null) return;
    if (url === '') {
      ed.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    ed.chain().focus().extendMarkRange('link').setLink({href: url}).run();
  }

  setImage(): void {
    const ed = this.editor();
    if (!ed) return;
    const url = window.prompt('Введите URL изображения:');
    if (!url) return;
    ed.chain().focus().setImage({src: url}).run();
  }

  // ─── Lists (Nested) ───

  canIndent(): boolean {
    return this.editor()?.can().sinkListItem('listItem') ?? false;
  }

  canOutdent(): boolean {
    return this.editor()?.can().liftListItem('listItem') ?? false;
  }

  indent(): void {
    this.editor()?.chain().focus().sinkListItem('listItem').run();
  }

  outdent(): void {
    this.editor()?.chain().focus().liftListItem('listItem').run();
  }

  // ─── Details / Toggle List ───

  toggleDetails(): void {
    const ed = this.editor();
    if (!ed) return;
    if (ed.isActive('details')) {
      ed.chain().focus().unsetDetails().run();
    } else {
      ed.chain().focus().setDetails().run();
    }
  }

  clearFormatting(): void {
    this.editor()?.chain().focus().clearNodes().unsetAllMarks().run();
  }

  reset(): void {
    this.editor()?.destroy();
    this.editor.set(undefined);
  }

  ngOnDestroy(): void {
    this.reset();
  }
}
