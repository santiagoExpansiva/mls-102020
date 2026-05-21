/// <mls fileReference="_102020_/l2/skills/molecules/index" enhancement="_blank"/>


export const skills = [
    // Category 1: Data Entry & Editing
    {
        name: 'groupSelectOne',
        description: 'Allows the user to select exactly one option from a list of mutually exclusive choices. Ideal for scenarios where a single, clear decision is required. Implementations include dropdown, radio group, segmented control, knob, and list picker.',
        skillReference: '/_102020_/l2/skills/molecules/groupSelectOne/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupSelectOne/usage',
    },
    {
        name: 'groupSelectMany',
        description: 'Allows the user to select one or more options from a list. Value is a comma-separated string of selected item values. Supports searchable filtering, min/max selection limits, grouped items, and disabled options. Implementations include checkbox group, chips/tags, multi-select dropdown, dual list (transfer list), card grid with selection, and toggle group.',
        skillReference: '/_102020_/l2/skills/molecules/groupSelectMany/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupSelectMany/usage',
    },
    {
        name: 'groupEnterText',
        description: 'Allows the user to input free-form text. Ideal for names, descriptions, comments, emails, passwords, and any textual data. Implementations include input, textarea, password input, masked input, input OTP, search input, and tag input.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterText/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterText/usage'
    },

    {
        name: 'groupEnterBoolean',
        description: 'Allows the user to input a true/false decision. Value is boolean — starts as false until the user changes it. Supports Label and Helper slot tags. Implementations are toggle/switch and checkbox, fully interchangeable by swapping the component tag.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterBoolean/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterBoolean/usage',
    },
    {
        name: 'groupEnterNumber',
        description: 'Allows the user to input numeric values. Ideal for quantities, measurements, percentages, ages, weights, and numeric configurations. Implementations include number input, stepper, slider, percentage input, and quantity selector.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterNumber/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterNumber/usage',
    },
    {
        name: 'groupEnterMoney',
        description: 'Allows the user to input monetary values with locale-aware formatting. Ideal for prices, payments, budgets, and financial transactions. Handles currency symbols, thousand separators, and decimal precision. Implementations include currency input, price field, money input, and currency converter.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterMoney/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterMoney/usage',
    },
    {
        name: 'groupEnterDatetime',
        description: 'Allows the user to input date and/or time values. Ideal for scheduling, deadlines, date ranges, and appointments. Implementations include date picker, time picker, datetime picker, date range picker, inline calendar, month picker, and year picker.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterDateTime/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterDateTime/usage'
    },

    {
        name: 'groupEnterDate',
        description: 'Allows the user to input a date only (no time). Ideal for birth dates, due dates, contract effective dates, expiration dates, and any scenario where the time of day is irrelevant. Implementations include date picker, masked date input, inline calendar, and month/year picker.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterDate/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterDate/usage'
    },
    {
        name: 'groupEnterTime',
        description: 'Allows the user to input a time only (no date). Ideal for business hours, recurring daily schedules, alarm times, opening and closing times, and shift configurations. Implementations include time picker with scrollable columns, masked time input, time spinner, and clock face.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterTime/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterTime/usage'
    },
    {
        name: 'groupEnterDateInterval',
        description: 'Allows the user to input a date range with a start date and an end date (no time). Ideal for vacation periods, report filters, campaign durations, contract validity, and hotel or flight booking dates. Implementations include date range picker with dual calendar, inline date range, and range picker with presets.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterDateInterval/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterDateInterval/usage'
    },
    {
        name: 'groupEnterDateTimeInterval',
        description: 'Allows the user to input a date+time range with a start datetime and an end datetime. Ideal for meeting scheduling, room reservations, maintenance windows, task time tracking, and any booking that requires exact start and end timestamps. Implementations include datetime range picker, event scheduler, and booking widget.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterDateTimeInterval/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterDateTimeInterval/usage'
    },
    {
        name: 'groupEnterTimeInterval',
        description: 'Allows the user to input a time range with a start time and an end time (no date). Ideal for work shifts, business hours configuration, recurring availability windows, class schedules, and break intervals. Supports overnight intervals that cross midnight. Implementations include time range picker, dual-handle timeline slider, and business hours grid.',
        skillReference: '/_102020_/l2/skills/molecules/groupEnterTimeInterval/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupEnterTimeInterval/usage'
    },
    {
        name: 'groupLocatePosition',
        description: 'Allows the user to inform or visualize a geographic location. Supports address search with autocomplete (suggestions provided by the page via BFF), geolocation capture, and map preview. Value is stored as a JSON string containing lat, lng, and address. Implementations include address autocomplete, map picker, geolocation button, and area selector.',
        skillReference: '/_102020_/l2/skills/molecules/groupLocatePosition/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupLocatePosition/usage'
    },

    {
        name: 'groupSelectFileForUpload',
        description: 'Allows the user to select one or more files to be uploaded. Stateless — emits selected File objects via change event; the page is responsible for uploading via BFF. Supports drag-and-drop, file type and size validation, and emits a reject event for invalid files. Implementations include drag-drop zone, file button, multi-file upload, camera capture, and paste from clipboard.',
        skillReference: '/_102020_/l2/skills/molecules/groupSelectFileForUpload/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupSelectFileForUpload/usage'
    },

    {
        name: 'groupTriggerAction',
        description: 'Allows the user to execute an action or command. Supports Label and Icon slot tags with flexible composition (text only, icon only, or both). Configurable variant (primary, secondary, danger, ghost, link), size, loading state, and icon position. Implementations include button, icon button, FAB, split button, and button group.',
        skillReference: '/_102020_/l2/skills/molecules/groupTriggerAction/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupTriggerAction/usage'
    },

    {
        name: 'groupShowProgress',
        description: 'Indicates the progress of an operation or process. Visual primitive designed for composition inside other components. Supports determinate mode (0-100%) and indeterminate mode (unknown duration). Implementations include progress bar, progress ring/circle, spinner, and percentage indicator.',
        skillReference: '/_102020_/l2/skills/molecules/groupShowProgress/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupShowProgress/usage'
    },
    {
        name: 'groupRateItem',
        description: 'Allows the user to rate or score an item. Supports auto-generated options from a numeric range (min/max/step) or custom options via Item slot tags (emoji, icons, text). Value is always a number. Implementations include star rating, thumbs up/down, emoji rating, NPS scale, and satisfaction slider.',
        skillReference: '/_102020_/l2/skills/molecules/groupRateItem/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupRateItem/usage'
    },
    {
        name: 'groupPlayMedia',
        description: 'Plays audio or video content. Media sources provided via Source slot tags with fallback format support. Shared contract for both audio and video — swap the component tag to change the player style. Supports autoplay, loop, mute, poster thumbnail, and subtitle tracks. Implementations include video player, audio player, mini player, and media controls.',
        skillReference: '/_102020_/l2/skills/molecules/groupPlayMedia/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupPlayMedia/usage'
    },
    {
        name: 'groupExpandContent',
        description: 'Allows the user to expand or collapse content sections to see more or less details. Manages multiple sections via Section slot tags with title, disabled, and expanded attributes. Supports accordion mode (single open) or multiple open simultaneously. Implementations include accordion, collapsible, show more/show less, expandable row, and details/summary.',
        skillReference: '/_102020_/l2/skills/molecules/groupExpandContent/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupExpandContent/usage'
    },
    {
        name: 'groupViewChart',
        description: 'Displays data through graphical representation. Data provided via Series and Point slot tags. All chart implementations share the same data contract — swap the component tag to change visualization. Supports multi-series (Line, Bar, Area, Radar, Scatter) and single-series (Pie, Donut, Funnel). Implementations include bar chart, line chart, area chart, pie chart, donut chart, scatter chart, radar chart, and funnel chart.',
        skillReference: '/_102020_/l2/skills/molecules/groupViewChart/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupViewChart/usage'
    },
    {
        name: 'groupViewCard',
        description: 'Displays an item as an independent visual unit. Composition primitive with flexible slot structure: header (title, description), content, footer, and action areas. All slots are optional. Supports variants (default, outlined, elevated, ghost), clickable, selectable, and loading states. Implementations include standard card, media card, compact card, horizontal card, and interactive card.',
        skillReference: '/_102020_/l2/skills/molecules/groupViewCard/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupViewCard/usage'
    },

    {
        name: 'groupScanCode',
        description: 'Captures information via camera (QR code, barcode, document). Component captures image frames and emits them; the page is responsible for decoding via BFF. Supports rear/front camera, auto-capture with configurable interval, and custom result display. Implementations include QR code scanner, barcode reader, document scanner (OCR), and camera viewfinder.',
        skillReference: '/_102020_/l2/skills/molecules/groupScanCode/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupScanCode/usage'
    },
    {
        name: 'groupSearchContent',
        description: 'Allows the user to find content using text search. Emits search events with debounce; page provides suggestions via Suggestion slot tags. Value holds the confirmed result — either a suggestion value or the raw typed text. Supports clear, loading state, and empty state. Implementations include search field, command palette (cmd+k), search with suggestions, and combobox.',
        skillReference: '/_102020_/l2/skills/molecules/groupSearchContent/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupSearchContent/usage'
    },
    {
        name: 'groupViewData',
        description: 'Display a collection of data with adaptive layout. The component decides the best presentation based on context (viewport, configuration). Use when displaying multiple records with defined fields and rich content.',
        skillReference: '/_102020_/l2/skills/molecules/groupViewData',
        skillUsageReference: ''
    },
    {
        name: 'groupViewTable',
        description: 'Displays structured data in tabular format. Data provided via TableHeader, TableBody, TableRow, TableHead, and TableCell slot tags. Supports column sorting, row selection with checkboxes, pagination, and isEditing propagation to web components inside cells. Implementations include data table, simple table, editable grid, virtualized table, and tree table.',
        skillReference: '/_102020_/l2/skills/molecules/groupViewTable/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupViewTable/usage'
    },
    {
        name: 'groupViewHierarchy',
        description: 'Displays hierarchical data structures with parent-child relationships. Uses recursive Node slot tags with free content that can nest indefinitely. Supports expand/collapse of nodes with children, accordion mode (one per level), and expand-all. Implementations include tree view, org chart, cascader, nested list, and mind map.',
        skillReference: '/_102020_/l2/skills/molecules/groupViewHierarchy/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupViewHierarchy/usage'
    },

    {
        name: 'groupViewMetric',
        description: 'Displays a highlighted indicator or metric. Purely visual — all data via slot tags (Label, Value, Icon, Trend with direction attribute, Helper). No value property, no events. Supports loading state. Implementations include big number, KPI card, sparkline, gauge/speedometer, and trend indicator.',
        skillReference: '/_102020_/l2/skills/molecules/groupViewMetric/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupViewMetric/usage'
    },

    {
        name: 'groupNavigateSteps',
        description: 'Allows the user to advance through a sequential multi-step process. Steps defined via Step slot tags with title, description, completed, and disabled attributes. Value is the active step index. Supports linear mode (must complete in order) and free navigation. Implementations include horizontal stepper, vertical stepper, wizard, progress steps.',
        skillReference: '/_102020_/l2/skills/molecules/groupNavigateSteps/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupNavigateSteps/usage'
    },

    {
        name: 'groupNavigateSection',
        description: 'Allows the user to switch between sections within the same context. Sections defined via Tab slot tags with value, title, icon, and disabled attributes. Value is the active tab identifier. Page is responsible for displaying each section content. Implementations include tabs, pills/segmented control, navigation menu, bottom navigation, and pagination.',
        skillReference: '/_102020_/l2/skills/molecules/groupNavigateSection/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupNavigateSection/usage'
    },
    {
        name: 'groupNotifyUser',
        description: 'Informs the user about events, status changes, or action results. Controlled via visible property. Supports notification types (info, success, warning, error), auto-dismiss with configurable duration, position hints, dismissible toggle, and optional action slot. Implementations include toast, snackbar, banner, alert, and inline alert.',
        skillReference: '/_102020_/l2/skills/molecules/groupNotifyUser/creation',
        skillUsageReference: '/_102020_/l2/skills/molecules/groupNotifyUser/usage'
    },

]