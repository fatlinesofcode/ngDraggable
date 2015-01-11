/*
 *
 * https://github.com/fatlinesofcode/ngDraggable
 */
angular.module("ngDraggable", [])
        .directive('ngDrag', ['$rootScope', '$parse', '$document', '$window', function ($rootScope, $parse, $document, $window) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    scope.value = attrs.ngDrag;
                    var offset,_centerAnchor=false,_mx,_my,_tx,_ty,_mrx,_mry;
                    var _hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
                    var _pressEvents = 'touchstart mousedown';
                    var _moveEvents = 'touchmove mousemove';
                    var _releaseEvents = 'touchend mouseup';



                    // Config   
                    var _ngDragEvents = ["Success"];

                    var _config = angular.extend({

                        OnSuccess: null,
                        Handle: "original",
                        Data: null

                    }, $parse(attrs.ngDragConfig)(scope));

                    _config = typeof _config === "object" ? _config : {};


                    // Scans all attributes of the element, looking for those that contain the name "ngDrag",
                    // and adding the data in the configuration variable

                    angular.forEach(attrs, function(value, key) {
                        if(key.indexOf("ngDrag")==0 && key != "ngDragConfig"){
                            var keyConfig = key.replace("ngDrag", "");
                            if(keyConfig!=""){

                                if(_ngDragEvents.indexOf(keyConfig)!=-1){
                                    keyConfig = "On"+keyConfig;
                                }

                                _config[keyConfig] = $parse(value)(scope);
                            }
                        }
                    });
                    // End Config

                    // to identify the element in order to prevent getting superflous events when a single element has both drag and drop directives on it.
                    var _myid = scope.$id; 
                    var _data = null;

                    var _dragEnabled = false;

                    var _pressTimer = null;

                    var onDragSuccessCallback = $parse(_config.OnSuccess) || null;

                    var _handle = null;

                    var initialize = function () {
                        //element = gethandle();
                        element.attr('draggable', 'false'); // prevent native drag
                        toggleListeners(true);
                    };

                    var getHandle = function () {

                        var handle = element;

                        if(_config.Handle == "clone"){

                            handle = element.clone();

                            offset = _privoffset(element);

                            handle.css({
                                left: (offset.left+'px'), top: (offset.top+'px'), position: 'fixed', 'z-index': 99999
                            });

                            element.parent().append(handle);

                        }else if(_config.Handle == "parent"){
                            handle = element.parent();

                        }else if(_config.Handle != "original"){ 
                            handle = angular.element(_config.Handle);
                        }


                        return handle;
                    };


                    var resetHandle = function () {

                        if(_config.Handle == "clone"){

                            _handle.remove();

                        }
                    }
                    
                    // this same func is in ngDrop, it needs to be DRYed up but don't know if its
                    // worth writing a service (or equivalent) for one function
                    var _privoffset = function (docElem) {                        
                        var box = { top: 0, left: 0 };
                        if (typeof docElem[0].getBoundingClientRect !== undefined) {
                            box = docElem[0].getBoundingClientRect();
                        }
                        return {
                            top: box.top + $window.pageYOffset - docElem[0].clientTop,
                            left: box.left + $window.pageXOffset - docElem[0].clientLeft
                        };
                    }                    

                    var toggleListeners = function (enable) {
                        if (!enable)return;
                        // add listeners.

                        scope.$on('$destroy', onDestroy);                       
                        scope.$watch(attrs.ngDrag, onEnableChange);                     
                        scope.$watch(attrs.ngCenterAnchor, onCenterAnchor);
                        scope.$watch(attrs.ngDragData, onDragDataChange);
                        element.on(_pressEvents, onpress);
                        if(! _hasTouch && element[0].nodeName.toLowerCase() == "img"){
                            element.on('mousedown', function(){ return false;}); // prevent native drag for images
                        }
                    };
                    var onDestroy = function (enable) {
                        toggleListeners(false);
                    };
                    var onDragDataChange = function (newVal, oldVal) {
                        _data = newVal;
                    };
                    var onEnableChange = function (newVal, oldVal) {
                        _dragEnabled = (newVal);
                    };
                    var onCenterAnchor = function (newVal, oldVal) {
                        if(angular.isDefined(newVal))
                        _centerAnchor = (newVal || 'true');
                    }
                    
                    var isClickableElement = function (evt) {
                        return (
                                angular.isDefined(angular.element(evt.target).attr("ng-click"))
                                || angular.isDefined(angular.element(evt.target).attr("ng-dblclick"))
                                || angular.isDefined(angular.element(evt.target).attr("ng-cancel-drag"))
                                );
                    }
                    /*
                     * When the element is clicked start the drag behaviour
                     * On touch devices as a small delay so as not to prevent native window scrolling
                     */
                    var onpress = function(evt) {
                        if(! _dragEnabled)return;

                        // disable drag on clickable element
                        if (isClickableElement(evt)) {
                            return;
                        }

                        if(_hasTouch){
                            cancelPress();
                            _pressTimer = setTimeout(function(){
                                cancelPress();
                                onlongpress(evt);
                            },100);
                            $document.on(_moveEvents, cancelPress);
                            $document.on(_releaseEvents, cancelPress);
                        }else{
                            onlongpress(evt);
                        }

                    }
                    var cancelPress = function() {
                        clearTimeout(_pressTimer);
                        $document.off(_moveEvents, cancelPress);
                        $document.off(_releaseEvents, cancelPress);
                    }
                    var onlongpress = function(evt) {
                        if(! _dragEnabled)return;
                        evt.preventDefault();

                        _handle = getHandle();

                        _handle.attr('draggable', 'false');

                        _handle.addClass('dragging');
                        offset = _privoffset(_handle); 

                        _handle.centerX = _handle[0].offsetWidth / 2;
                        _handle.centerY = _handle[0].offsetHeight / 2;    
                        
                        _mx = (evt.pageX || evt.touches[0].pageX);
                        _my = (evt.pageY || evt.touches[0].pageY);
                        _mrx = _mx - offset.left;
                        _mry = _my - offset.top;
                         if (_centerAnchor) {
                             _tx = _mx - _handle.centerX - $window.pageXOffset;
                             _ty = _my - _handle.centerY - $window.pageYOffset;
                        } else {
                             _tx = _mx - _mrx - $window.pageXOffset;
                             _ty = _my - _mry - $window.pageYOffset;
                        }                        
                        
                        $document.on(_moveEvents, onmove);
                        $document.on(_releaseEvents, onrelease);
                        $rootScope.$broadcast('draggable:start', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, handle: _handle, element:element, data:_data});
                    }

                    var onmove = function (evt) {
                        if (!_dragEnabled)return;
                        evt.preventDefault();

                        _mx = (evt.pageX || evt.touches[0].pageX);
                        _my = (evt.pageY || evt.touches[0].pageY);

                         if (_centerAnchor) {
                             _tx = _mx - _handle.centerX - $window.pageXOffset;
                             _ty = _my - _handle.centerY - $window.pageYOffset;
                        } else {
                             _tx = _mx - _mrx - $window.pageXOffset;
                             _ty = _my - _mry - $window.pageYOffset;
                        }

                        moveElement(_tx, _ty);

                        $rootScope.$broadcast('draggable:move', { x: _mx, y: _my, tx: _tx, ty: _ty, event: evt, handle: _handle, element: element, data: _data, uid: _myid });
                    }

                    var onrelease = function(evt) {
                        if (!_dragEnabled)
                            return;
                        evt.preventDefault();
                        $rootScope.$broadcast('draggable:end', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, handle: _handle, element:element, data:_data, callback:onDragComplete, uid: _myid});
                        _handle.removeClass('dragging');
                        reset();
                        $document.off(_moveEvents, onmove);
                        $document.off(_releaseEvents, onrelease);
                    }

                    var onDragComplete = function(evt) {
                        if (!onDragSuccessCallback )return;

                        scope.$apply(function () {
                            onDragSuccessCallback(scope, {$data: _data, $event: evt});
                        });
                    }

                    var reset = function() {

                        _handle.css({left:'',top:'', position:'', 'z-index':'', margin: ''});
                        resetHandle();
                    }

                    var moveElement = function (x, y) {
                        _handle.css({
                            left: (x+'px'), top: (y+'px'), position: 'fixed', 'z-index': 99999
                            //,margin: '0'  don't monkey with the margin, 
                        });
                    }
                    initialize();
                }
            }
        }])

        .directive('ngDrop', ['$parse', '$timeout', '$window', function ($parse, $timeout, $window) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    scope.value = attrs.ngDrop;

                    var _myid = scope.$id;

                    var _dropEnabled=false;

                    var onDropCallback = $parse(attrs.ngDropSuccess);// || function(){};

                    var initialize = function () {
                        toggleListeners(true);
                    };

                    var toggleListeners = function (enable) {
                        // remove listeners

                        if (!enable)return;
                        // add listeners.
                        attrs.$observe("ngDrop", onEnableChange);
                        scope.$on('$destroy', onDestroy);
                        //scope.$watch(attrs.uiDraggable, onDraggableChange);
                        scope.$on('draggable:start', onDragStart);
                        scope.$on('draggable:move', onDragMove);
                        scope.$on('draggable:end', onDragEnd);
                    };
                    
                    // this same func is in ngDrag, it needs to be DRYed up but don't know if its
                    // worth writing a service (or equivalent) for one function
                    var _privoffset = function (docElem) {                        
                        var box = { top: 0, left: 0 };
                        if (typeof docElem[0].getBoundingClientRect !== undefined) {
                            box = docElem[0].getBoundingClientRect();
                        }
                        return {
                            top: box.top + $window.pageYOffset - docElem[0].clientTop,
                            left: box.left + $window.pageXOffset - docElem[0].clientLeft
                        };
                    }                    

                    var onDestroy = function (enable) {
                        toggleListeners(false);
                    };
                    var onEnableChange = function (newVal, oldVal) {
                        _dropEnabled=scope.$eval(newVal);
                    }
                    var onDragStart = function(evt, obj) {
                        if(! _dropEnabled)return;
                        isTouching(obj.x,obj.y,obj.handle);
                    }
                    var onDragMove = function(evt, obj) {
                        if(! _dropEnabled)return;
                        isTouching(obj.x,obj.y,obj.handle);
                    }

                    var onDragEnd = function (evt, obj) {
                        
                        // don't listen to drop events if this is the element being dragged
                        if (!_dropEnabled || _myid === obj.uid)return;
                        if (isTouching(obj.x, obj.y, obj.handle)) {
                            // call the ngDraggable ngDragSuccess element callback
                           if(obj.callback){
                                obj.callback(obj);
                            }

                            $timeout(function(){
                                onDropCallback(scope, {$data: obj.data, $event: obj});
                            });
                        }
                        updateDragStyles(false, obj.handle);
                    }

                    var isTouching = function(mouseX, mouseY, dragElement) {
                        var touching= hitTest(mouseX, mouseY);
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

                    var hitTest = function(x, y) {
                        var bounds = _privoffset(element);
                        bounds.right = bounds.left + element[0].offsetWidth;
                        bounds.bottom = bounds.top + element[0].offsetHeight;
                        return  x >= bounds.left
                                && x <= bounds.right
                                && y <= bounds.bottom
                                && y >= bounds.top;
                    }

                    initialize();
                }
            }
        }])
        .directive('ngDragClone', ['$parse', '$timeout', function ($parse, $timeout) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    var img, _allowClone=true;
                    scope.clonedData = {};
                    var initialize = function () {

                        img = element.find('img');
                        element.attr('draggable', 'false');
                        img.attr('draggable', 'false');
                        reset();
                        toggleListeners(true);
                    };


                    var toggleListeners = function (enable) {
                        // remove listeners

                        if (!enable)return;
                        // add listeners.
                        scope.$on('draggable:start', onDragStart);
                        scope.$on('draggable:move', onDragMove);
                        scope.$on('draggable:end', onDragEnd);
                        preventContextMenu();

                    };
                    var preventContextMenu = function() {
                      //  element.off('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                        img.off('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                      //  element.on('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                        img.on('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                    }
                    var onDragStart = function(evt, obj, elm) {
                        _allowClone=true
                        if(angular.isDefined(obj.data.allowClone)){
                            _allowClone=obj.data.allowClone;
                        }
                        if(_allowClone) {
                            scope.$apply(function () {
                                scope.clonedData = obj.data;
                            });
                            element.css('width', obj.element[0].offsetWidth);
                            element.css('height', obj.element[0].offsetHeight);

                            moveElement(obj.tx, obj.ty);
                        }
                    }
                    var onDragMove = function(evt, obj) {
                        if(_allowClone) {
                            moveElement(obj.tx, obj.ty);
                        }
                    }
                    var onDragEnd = function(evt, obj) {
                        //moveElement(obj.tx,obj.ty);
                        if(_allowClone) {
                            reset();
                        }
                    }

                    var reset = function() {
                        element.css({left:0,top:0, position:'fixed', 'z-index':-1, visibility:'hidden'});
                    }
                    var moveElement = function(x,y) {
                        element.css({
                            left: (x+'px'), top: (y+'px'), position: 'fixed', 'z-index': 99999, 'visibility': 'visible'
                            //,margin: '0'  don't monkey with the margin, 
                        });
                    }

                    var absorbEvent_ = function (event) {
                        var e = event.originalEvent;
                        e.preventDefault && e.preventDefault();
                        e.stopPropagation && e.stopPropagation();
                        e.cancelBubble = true;
                        e.returnValue = false;
                        return false;
                    }

                    initialize();
                }
            }
        }])
    .directive('ngPreventDrag', ['$parse', '$timeout', function ($parse, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var initialize = function () {

                    element.attr('draggable', 'false');
                    toggleListeners(true);
                };


                var toggleListeners = function (enable) {
                    // remove listeners

                    if (!enable)return;
                    // add listeners.
                    element.on('mousedown touchstart touchmove touchend touchcancel', absorbEvent_);
                };


                var absorbEvent_ = function (event) {
                    var e = event.originalEvent;
                    e.preventDefault && e.preventDefault();
                    e.stopPropagation && e.stopPropagation();
                    e.cancelBubble = true;
                    e.returnValue = false;
                    return false;
                }

                initialize();
            }
        }
    }])
    .directive('ngCancelDrag', [function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element.find('*').attr('ng-cancel-drag', 'ng-cancel-drag');
            }
        }
    }]);
