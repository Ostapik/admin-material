export const treeFilter = (filterText: string, treeData) => {
  let filteredTreeData;
  if (filterText) {
    // Filter the tree
    function filter(array, text) {
      const getChildren = (result, object) => {
        if (object.item.toLowerCase().includes(text.toLowerCase()) ) {
          result.push(object);
          return result;
        }
        if (Array.isArray(object.children)) {
          const children = object.children.reduce(getChildren, []);
          if (children.length) result.push({ ...object, children });
        }
        return result;
      };

      return array.reduce(getChildren, []);
    }

    filteredTreeData = filter(treeData, filterText);
  } else {
    // Return the initial tree
    filteredTreeData = treeData;
  }

  // Build the tree nodes from Json object. The result is a list of `TodoItemNode` with nested
  // file node as children.
  return filteredTreeData;
}