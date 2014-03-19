/*
 *
 * @usage <div ng-draggable=""></div>
 */
angular.module("draggable", [])
        .directive('ngDraggable', ['$rootScope', '$parse', function ($rootScope, $parse) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    scope.value = attrs.ngDraggable;
                    console.log("ngDraggable", "link", "", scope.value);

                    var offset;

                    var _pressEvents = 'touchstart mousedown';
                    var _moveEvents = 'touchmove mousemove';
                    var _releaseEvents = 'touchend mouseup';

                    var $document = $(document);
                    var $window = $(window);
                    var _data = null;

                    var onDragSuccessCallback = $parse(attrs.ngOnDragSuccess) || function(){};

                    var initialize = function () {

                        toggleListeners(true);
                    };


                    var toggleListeners = function (enable) {
                        // remove listeners

                        if (!enable)return;
                        // add listeners.

                        scope.$on('$destroy', onDestroy);
                        scope.$watch(attrs.ngDraggable, onDraggableChange);
                        scope.$watch(attrs.dragData, onDragDataChange);
                        element.on(_pressEvents, onpress);
                    };
                    var onDestroy = function (enable) {
                        toggleListeners(false);
                    };
                    var onDragDataChange = function (newVal, oldVal) {
                        _data = newVal;
                        console.log("69","onDragDataChange","data", _data);
                    }
                    var onDraggableChange = function (newVal, oldVal) {
                        console.log("41", "ngDraggable::onDraggableChange", "newVal", newVal);
                    }
                    var onpress = function(evt) {
                        evt.preventDefault();
                        offset = element.offset();
                        element.centerX = (element.width()/2);
                        element.centerY = (element.height()/2);
                        element.addClass('dragging');
                        position(offset.left - $window.scrollLeft(), offset.top- $window.scrollTop());
                        $document.on(_moveEvents, onmove);
                        $document.on(_releaseEvents, onrelease);
                        $rootScope.$broadcast('draggable:start', {element:element, data:_data});

                    }
                    var onmove = function(evt) {
                        evt.preventDefault();

                        var tx=(evt.pageX || evt.originalEvent.touches[0].pageX)-element.centerX-$window.scrollLeft()
                        var ty=(evt.pageY || evt.originalEvent.touches[0].pageY) -element.centerY-$window.scrollTop();

                        position(tx, ty);

                        $rootScope.$broadcast('draggable:move', {element:element, data:_data});

                    }
                    var onrelease = function(evt) {
                        evt.preventDefault();
                        $rootScope.$broadcast('draggable:end', {element:element, data:_data, callback:onDragComplete});
                        element.removeClass('dragging');
                        reset();
                        $document.off(_moveEvents, onmove);
                        $document.off(_releaseEvents, onrelease);

                    }
                    var onDragComplete = function(evt) {
                        scope.$apply(function () {
                            onDragSuccessCallback(scope, {$data: _data, $event: evt});
                        });
                    }
                    var reset = function() {
                        element.css({left:'',top:'', position:'', 'z-index':''});
                    }
                    var position = function(x,y) {
                        element.css({left:x,top:y, position:'fixed', 'z-index':9999});
                    }
                    initialize();
                }
            }
        }])
        .directive('ngDropArea', ['$parse', function ($parse) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    scope.value = attrs.ngDropArea;

                    var onDropCallback = $parse(attrs.ngOnDrop) || function(){};
                    var initialize = function () {
                        toggleListeners(true);
                    };


                    var toggleListeners = function (enable) {
                        // remove listeners

                        if (!enable)return;
                        // add listeners.

                        scope.$on('$destroy', onDestroy);
                        scope.$watch(attrs.uiDraggable, onDraggableChange);
                        scope.$on('draggable:start', onDragStart);
                        scope.$on('draggable:move', onDragMove);
                        scope.$on('draggable:end', onDragEnd);
                    };
                    var onDestroy = function (enable) {
                        toggleListeners(false);
                    };
                    var onDraggableChange = function (newVal, oldVal) {
                        console.log("41", "onDraggableChange", "newVal", newVal);
                    }
                    var onDragStart = function(evt, obj) {
                        isTouching(obj.element);
                    }
                    var onDragMove = function(evt, obj) {
                        isTouching(obj.element);
                    }
                    var onDragEnd = function(evt, obj) {
                        if(isTouching(obj.element)){
                            // call the ngDraggable element callback
                            if(obj.callback){
                                obj.callback(evt);
                            }
                            // call the ngDrop element callback
                            scope.$apply(function () {
                                onDropCallback(scope, {$data: obj.data, $event: evt});
                            });

                        }
                        updateDragStyles(false, obj.element);
                    }
                    var isTouching = function(dragElement) {
                        var touching= hitTest(element, dragElement);
                        updateDragStyles(touching, dragElement);
                        return touching;
                    }
                    var updateDragStyles = function(touching, dragElement) {
                        if(touching){
                            element.addClass('drag-enter');
                            dragElement.addClass('drag-over');
                        }else{
                            element.removeClass('drag-enter');
                            dragElement.removeClass('drag-over');
                        }
                    }
                    var hitTest = function(a, b) {
                        var aPos = a.offset();
                        var bPos = b.offset();


                        var aLeft = aPos.left;
                        var aRight = aPos.left + a.outerWidth();
                        var aTop = aPos.top;
                        var aBottom = aPos.top + a.outerHeight();

                        var bLeft = bPos.left;
                        var bRight = bPos.left + b.outerWidth();
                        var bTop = bPos.top;
                        var bBottom = bPos.top + b.outerHeight();

                        return !( bLeft > aRight || bRight < aLeft || bTop > aBottom || bBottom < aTop  );
                    }
                    initialize();
                }
            }
        }]);