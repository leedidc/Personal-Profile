(() => {
  'use strict';
  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'code',
    'color',
    'background',
    'list',
    'indent',
    'align',
    'blockquote',
    'code-block',
    'link',
    'image',
    'alt',
  ];

  async function prepareImage(file) {
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      throw new Error('15MB 이하의 PNG·JPEG·WebP 이미지를 선택해 주세요.');
    }
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', 0.88);
    } finally {
      bitmap.close();
    }
  }

  function create(onChange, onError) {
    const imageInput = document.getElementById('post-image');
    const linkDialog = document.getElementById('link-dialog');
    let linkRange;
    let imageRange;
    let insertingImage = false;
    const editor = new Quill('#rich-editor', {
      theme: 'snow',
      placeholder: '공부한 내용, 기억하고 싶은 것들을 적어 보세요…',
      formats,
      modules: {
        history: { delay: 700, maxStack: 100, userOnly: true },
        toolbar: {
          container: '#post-toolbar',
          handlers: {
            undo() {
              this.quill.history.undo();
            },
            redo() {
              this.quill.history.redo();
            },
            image() {
              imageRange = editor.getSelection(true);
              imageInput.click();
            },
            link(value) {
              if (!value) {
                editor.format('link', false, 'user');
                return;
              }
              linkRange = editor.getSelection(true);
              document.getElementById('link-url').value = '';
              document.getElementById('link-error').textContent = '';
              linkDialog.showModal();
              document.getElementById('link-url').focus();
            },
          },
        },
      },
    });
    editor.root.setAttribute('aria-label', '글 본문');
    editor.root.setAttribute('role', 'textbox');
    editor.root.setAttribute('aria-multiline', 'true');
    editor.on('text-change', (_delta, _old, source) => {
      if (source === 'user') {
        onChange();
      }
    });

    // 외부 문서의 HTML은 Quill이 변환한 뒤 허용한 서식과 URL만 남깁니다.
    editor.clipboard.addMatcher(Node.ELEMENT_NODE, (_node, delta) => {
      delta.ops = delta.ops.filter(
        (operation) =>
          typeof operation.insert === 'string' || Posts.safeImage(operation.insert?.image),
      );
      for (const operation of delta.ops) {
        if (operation.attributes) {
          const attributes = {};
          for (const [key, value] of Object.entries(operation.attributes)) {
            try {
              Posts.validateDocument({
                version: 1,
                id: 'paste',
                content: { ops: [{ insert: 'x', attributes: { [key]: value } }] },
              });
              attributes[key] = value;
            } catch {
              /* 지원하지 않는 붙여넣기 서식은 제외합니다. */
            }
          }
          operation.attributes = attributes;
        }
      }
      return delta;
    });

    async function insertImages(files, range) {
      if (insertingImage || !editor.isEnabled()) {
        return;
      }
      insertingImage = true;
      const documentId = editor.root.dataset.documentId;
      try {
        let position = range?.index ?? editor.getLength() - 1;
        for (const file of files) {
          const image = await prepareImage(file);
          if (documentId !== editor.root.dataset.documentId || !editor.isEnabled()) {
            return;
          }
          const Delta = Quill.import('delta');
          const next = editor
            .getContents()
            .compose(
              new Delta().retain(position).insert({ image }, { alt: file.name.slice(0, 300) }),
            );
          Posts.validateDocument({ version: 1, id: 'image-check', content: next });
          editor.insertEmbed(position, 'image', image, 'user');
          editor.formatText(position, 1, 'alt', file.name.slice(0, 300), 'user');
          position += 1;
        }
        editor.setSelection(position, 0, 'silent');
      } catch (error) {
        onError(error.message);
      } finally {
        insertingImage = false;
        imageInput.value = '';
      }
    }
    imageInput.addEventListener('change', () => insertImages([...imageInput.files], imageRange));
    editor.root.addEventListener(
      'paste',
      (event) => {
        const files = [...(event.clipboardData?.files || [])];
        if (files.length) {
          event.preventDefault();
          event.stopImmediatePropagation();
          insertImages(files, editor.getSelection(true));
        }
      },
      true,
    );
    editor.root.addEventListener('dragover', (event) => {
      if (event.dataTransfer.types.includes('Files')) {
        event.preventDefault();
      }
    });
    editor.root.addEventListener(
      'drop',
      (event) => {
        if (event.dataTransfer.files.length) {
          event.preventDefault();
          event.stopImmediatePropagation();
          insertImages([...event.dataTransfer.files], editor.getSelection());
        }
      },
      true,
    );
    document.getElementById('cancel-link').addEventListener('click', () => linkDialog.close());
    document.getElementById('link-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const url = Posts.safeLink(document.getElementById('link-url').value.trim());
      if (!url) {
        document.getElementById('link-error').textContent =
          'https://로 시작하는 주소를 입력해 주세요.';
        return;
      }
      if (linkRange.length) {
        editor.formatText(linkRange.index, linkRange.length, 'link', url, 'user');
      } else {
        editor.insertText(linkRange.index, url, { link: url }, 'user');
      }
      linkDialog.close();
    });
    return editor;
  }
  window.PostsRichEditor = { create };
})();
