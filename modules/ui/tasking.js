import _debounce from 'lodash-es/debounce';
import { event as d3_event, select as d3_select } from 'd3-selection';

import { t, textDirection } from '../util/locale';
import { svgIcon } from '../svg/icon';
import { uiDisclosure } from './disclosure';
import { uiTooltipHtml } from './tooltipHtml';
import { tooltip } from '../util/tooltip';

import { uiSettingsCustomTasking } from './settings/custom_tasking';
import { uiTaskingTaskEditor } from './taskingTaskEditor';


export function uiTasking(context) {

  var taskingTaskEditor = uiTaskingTaskEditor(context);

    var key = t('tasking.key');

    var taskingService = context.tasking();

    var layer = context.layers().layer('tasking');

    var _pane = d3_select(null);
    var _toggleButton = d3_select(null);
    var _taskingManagerContainer = d3_select(null);
    var _taskingTaskContainer = d3_select(null);

    var _task = taskingService.currentTask();

    var settingsCustomTasking = uiSettingsCustomTasking(context)
        .on('change', customTaskingChanged);

    // zoom to data
    taskingService.event.on('loadedTask', function fitZoom() {
        layer.fitZoom();
    });



    function showsLayer() {
        if (layer) {
            return layer.enabled();
        }
        return false;
    }


    function setLayer(enabled) {
        // Don't allow layer changes while drawing - #6584
        var mode = context.mode();
        if (mode && /^draw/.test(mode.id)) return;

        if (layer) {
            layer.enabled(enabled);

            update();
        }
    }


    function setManager(d) {

        function layerSupported() {
            return layer && layer.supported();
        }

        taskingService.currentManager(d); // set new manager

        if (d.managerId === 'none') {
            taskingService.resetProjectAndTask();
            setLayer(false);

        } else {

            // check if layer is supported
            if (!layerSupported() || d.managerId !== 'custom') return;

            // handle custom manager
            if (d.managerId === 'custom') {

                var project = taskingService.getProject(taskingService.customSettings().projectId);
                var task = taskingService.getTask(taskingService.customSettings().taskId);

                if (project && task) {
                    // load project & task
                    taskingService.currentProject(project);
                    taskingService.currentTask(task);
                }
            }

            setLayer(true); // enable layer

        }

        update();
    }

    function showsManager(d) {
        return taskingService.currentManager() && taskingService.currentManager().managerId === d.managerId;
    }


    function update() {
        _task = taskingService.currentTask();

        if (!_pane.select('.disclosure-wrap-tasking_managers').classed('hide')) {
            updateTaskingManagers();
        }

        if (!_pane.select('.disclosure-wrap-tasking_task').classed('hide')) {
            updateTaskingTask();
        }
    }


    function renderTaskingManagers(selection) {
        var container = selection.selectAll('.tasking-managers-container')
            .data([0]);

        _taskingManagerContainer = container.enter()
            .append('div')
            .attr('class', 'tasking-managers-container')


        var ul = _taskingManagerContainer
            .selectAll('.layer-list-tasking')
            .data(layer ? [0] : []);

        // Exit
        ul.exit()
            .remove();

        // Enter
        ul.enter()
            .append('ul')
            .attr('class', 'layer-list layer-list-tasking');

        _taskingManagerContainer
            .merge(container);

        updateTaskingManagers();
    }


    function updateTaskingManagers() {
        _taskingManagerContainer.selectAll('.layer-list-tasking')
            .call(drawListItems, taskingService.managers(), 'radio', 'manager', setManager, showsManager);

        // _taskingManagerContainer
        //     .call(drawManagerItems);
    }


    function drawListItems(selection, data, type, name, change, active) {

        var items = selection.selectAll('li')
            .data(data);

        // Exit
        items.exit()
            .remove();

        // Enter
        var enter = items.enter()
            .append('li')
            .attr('class', function(d) { return 'manager-' + d.managerId; })
            .call(tooltip()
                .title(function(d) {
                    return t('tasking.manager.managers.' + d.managerId + '.tooltip') || null;
                })
                .placement('bottom')
            );

        var customManager = enter.filter(function(d) { return d.managerId === 'custom'; });

        customManager
            .append('button')
            .attr('class', 'manager-browse')
            .on('click', editCustomTasking)
            .call(svgIcon('#iD-icon-more'));

        customManager
            .append('button')
            .call(tooltip()
                .title(t('tasking.manager.managers.custom.zoom'))
                .placement((textDirection === 'rtl') ? 'right' : 'left')
            )
            .on('click', function() {
                d3_event.preventDefault();
                d3_event.stopPropagation();
                layer.fitZoom();
            })
            .call(svgIcon('#iD-icon-search'));

        var label = enter
            .append('label');

        label
            .append('input')
            .attr('type', type)
            .attr('name', name)
            .on('change', change);

        label
            .append('span')
            .text(function(d) { return d.name; });


        // Update
        items = items
            .merge(enter);

        items
            .classed('active', active)
            .selectAll('input')
            .property('checked', active);

        // // enable/disable custom if there is data
        // var hasData = layer && layer.hasData();

        // items
        //     .selectAll('.manager-custom')
        //     .selectAll('label')
        //         .property('class', 'testingClass')
        //         .classed('deemphasize', !hasData)
        //         .property('disabled', !hasData);

    }

    // NOTE: TAH - update drawListItems so that custom is disabled (like below) without data. Then, handle custom data & make sure toggle updates colors


    function drawManagerItems(selection) {
        var hasData = layer && layer.hasData();
        var showsData = hasData && layer.enabled();

        var ul = selection
            .selectAll('.layer-list-tasking')
            .data(layer ? [0] : []);

        // Exit
        ul.exit()
            .remove();

        // Enter
        var ulEnter = ul.enter()
            .append('ul')
            .attr('class', 'layer-list layer-list-tasking');


        // Enter custom
        var liEnterCustom = ulEnter
            .append('li')
            .attr('class', 'list-item-tasking custom');

        liEnterCustom
            .append('button')
            .call(tooltip()
                .title(t('tasking.manager.managers.custom.settings.tooltip'))
                .placement((textDirection === 'rtl') ? 'right' : 'left')
            )
            .on('click', editCustomTasking)
            .call(svgIcon('#iD-icon-more'));

        liEnterCustom
            .append('button')
            .call(tooltip()
                .title(t('tasking.manager.managers.custom.zoom'))
                .placement((textDirection === 'rtl') ? 'right' : 'left')
            )
            .on('click', function() {
                d3_event.preventDefault();
                d3_event.stopPropagation();
                layer.fitZoom();
            })
            .call(svgIcon('#iD-icon-search'));

        var labelEnterCustom = liEnterCustom
            .append('label')
            .call(tooltip()
                .title(t('tasking.manager.managers.custom.tooltip'))
                .placement('bottom')
            );

            labelEnterCustom
            .append('input')
            .attr('type', 'checkbox')
            .on('change', function() { toggleManager(); });

        labelEnterCustom
            .append('span')
            .text(t('tasking.manager.managers.custom.title'));


        // Enter none
        var liEnterNone = ulEnter
            .append('li')
            .attr('class', 'list-item-tasking none');

        var labelEnterNone = liEnterNone
            .append('label')
            .call(tooltip()
                .title(t('tasking.manager.managers.none.tooltip'))
                .placement('bottom')
            );

        labelEnterNone
            .append('input')
            .attr('type', 'checkbox')
            .on('change', function() { toggleManager(); });

        labelEnterNone
            .append('span')
            .text(t('tasking.manager.managers.none.title'));

        // Update
        ul = ul
            .merge(ulEnter);

        ul.selectAll('.list-item-tasking')
            .classed('active', showsData)
            .selectAll('label')
            .classed('deemphasize', !hasData)
            .selectAll('input')
            .property('disabled', !hasData)
            .property('checked', showsData);
    }


    function editCustomTasking() {
        d3_event.preventDefault();
        context.container()
            .call(settingsCustomTasking);
    }


    function customTaskingChanged(settings) {

        if (settings && settings.url) {

            // load custom data
            taskingService.setCustom(settings);

            // // set manager
            setManager(taskingService.getManager('custom'));
        }
    }


    function renderTaskingTask(selection) {
        var container = selection.selectAll('.tasking-task-container')
            .data([0]);

        _taskingTaskContainer = container.enter()
            .append('div')
            .attr('class', 'tasking-task-container')
            .merge(container);

            updateTaskingTask();
    }


    function updateTaskingTask() {
        _taskingTaskContainer
            .call(taskingTaskEditor.datum(
                function(){ return showsLayer() ? _task : undefined; }()
            ));
    }


    function hidePane() {
        context.ui().togglePanes();
    }


    var paneTooltip = tooltip()
        .placement((textDirection === 'rtl') ? 'right' : 'left')
        .html(true)
        .title(uiTooltipHtml(t('tasking.description'), key));


    uiTasking.togglePane = function() {
        if (d3_event) d3_event.preventDefault();
        paneTooltip.hide(_toggleButton);
        context.ui().togglePanes(!_pane.classed('shown') ? _pane : undefined);
    };


    uiTasking.renderToggleButton = function(selection) {

        _toggleButton = selection
            .append('button')
            .attr('tabindex', -1)
            .on('click', uiTasking.togglePane)
            .call(svgIcon('#iD-icon-tasking', 'light'))
            // .call(addNotificationBadge) // TODO: TAH - add notification when details within the pane has changed
            .call(paneTooltip);

            // TODO: change color of button when tasking is enabled
    };


    uiTasking.renderPane = function(selection) {

        _pane = selection
            .append('div')
            .attr('class', 'fillL map-pane tasking-pane hide')
            .attr('pane', 'map-tasking');


        var heading = _pane
            .append('div')
            .attr('class', 'pane-heading');

        heading
            .append('h2')
            .text(t('tasking.title'));

        heading
            .append('button')
            .on('click', hidePane)
            .call(svgIcon('#iD-icon-close'));


        var content = _pane
            .append('div')
            .attr('class', 'pane-content');


            // tasking
        content
            .append('div')
            .attr('class', 'map-data-tasking')
            .call(uiDisclosure(context, 'tasking_managers', false)
                .title(t('tasking.manager.name'))
                .content(renderTaskingManagers)
            );


        // task
        content
            .append('div')
            .attr('class', 'tasking-task-container')
            .call(uiDisclosure(context, 'tasking_task', true)
                .title(t('tasking.task.name'))
                .content(renderTaskingTask)
            );


        context.keybinding()
            .on(key, uiTasking.togglePane);
    };

    return uiTasking;
}