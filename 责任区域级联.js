(() => {
  const path = value => String(value || '').split(/\s*\/\s*|\s*>\s*|-/).map(part => part.trim()).filter(Boolean).join(' / ');
  const selection = value => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(path).filter(Boolean);
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(path).filter(Boolean); } catch {}
    return [path(value)];
  };
  const matches = (selected, value) => {
    const list = selection(selected), current = path(value);
    return !list.length || list.some(item => current === item || current.startsWith(item + ' / '));
  };
  const options = values => {
    const roots = [];
    [...new Set(values.filter(Boolean).map(path))].sort().forEach(value => {
      let children = roots, prefix = '';
      value.split(' / ').forEach(label => {
        prefix = prefix ? prefix + ' / ' + label : label;
        let node = children.find(item => item.value === prefix);
        if (!node) { node = {label, value:prefix, children:[]}; children.push(node); }
        children = node.children;
      });
    });
    const prune = nodes => nodes.forEach(node => node.children.length ? prune(node.children) : delete node.children);
    prune(roots); return roots;
  };
  window.AreaCascade = {path, selection, matches, options};
})();
