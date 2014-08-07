ngDraggable
===========

Drag and drop module for Angular JS with support for touch devices. [`demo`](http://htmlpreview.github.io/?https://github.com/fatlinesofcode/ngDraggable/blob/master/example.html).

## Usage
1. Include the `ngDraggable.js` script provided by this component into your app.
2. Add `ngDraggable` as a module dependency to your app.

Draggable usage:
```html
<div ng-drag="true" ng-drag-data="{obj}" ng-drag-success="onDragComplete($data,$event)" >
  Draggable div
</div>
```

Drop area usage:
```html
<div ng-drop="true" ng-drop-success="onDropComplete($data,$event)" >
  Drop area
</div>
```

### Angular Controller:

```js
app.controller('MainCtrl', function ($scope) {
    $scope.onDragComplete=function(data,evt){
       console.log("drag success, data:", data);
    }
    $scope.onDropComplete=function(data,evt){
        console.log("drop success, data:", data);
    }
 };
```

## Examples
[`Drag and drop`](http://htmlpreview.github.io/?https://github.com/fatlinesofcode/ngDraggable/blob/master/example.html).

[`Re-ordering`](http://htmlpreview.github.io/?https://github.com/fatlinesofcode/ngDraggable/blob/master/example-reorder.html).

[`Cloning`](http://htmlpreview.github.io/?https://github.com/fatlinesofcode/ngDraggable/blob/master/example-clone.html).
