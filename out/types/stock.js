"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringState = void 0;
/**
 * 监控状态枚举
 */
var MonitoringState;
(function (MonitoringState) {
    MonitoringState["STOPPED"] = "stopped";
    MonitoringState["STARTING"] = "starting";
    MonitoringState["RUNNING"] = "running";
    MonitoringState["STOPPING"] = "stopping";
    MonitoringState["ERROR"] = "error"; // 错误状态
})(MonitoringState = exports.MonitoringState || (exports.MonitoringState = {}));
//# sourceMappingURL=stock.js.map