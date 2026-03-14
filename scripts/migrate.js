"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var postgres_1 = require("postgres");
var databaseUrl = (_a = process.env.DATABASE_URL) !== null && _a !== void 0 ? _a : "postgres://postgres:postgres@localhost:5432/embeddings_demo";
var client = (0, postgres_1.default)(databaseUrl, {
    max: 1,
});
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var migrationsDir, migrationFiles, appliedRows, applied, _loop_1, _i, migrationFiles_1, file;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    migrationsDir = node_path_1.default.resolve(process.cwd(), "drizzle");
                    return [4 /*yield*/, promises_1.default.readdir(migrationsDir)];
                case 1:
                    migrationFiles = (_a.sent())
                        .filter(function (file) { return file.endsWith(".sql"); })
                        .sort(function (a, b) { return a.localeCompare(b); });
                    return [4 /*yield*/, client(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    CREATE TABLE IF NOT EXISTS schema_migrations (\n      id BIGSERIAL PRIMARY KEY,\n      file_name TEXT NOT NULL UNIQUE,\n      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n    )\n  "], ["\n    CREATE TABLE IF NOT EXISTS schema_migrations (\n      id BIGSERIAL PRIMARY KEY,\n      file_name TEXT NOT NULL UNIQUE,\n      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n    )\n  "])))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, client(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    SELECT file_name FROM schema_migrations\n  "], ["\n    SELECT file_name FROM schema_migrations\n  "])))];
                case 3:
                    appliedRows = _a.sent();
                    applied = new Set(appliedRows.map(function (row) { return row.file_name; }));
                    _loop_1 = function (file) {
                        var sqlContent;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (applied.has(file)) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    return [4 /*yield*/, promises_1.default.readFile(node_path_1.default.join(migrationsDir, file), "utf8")];
                                case 1:
                                    sqlContent = _b.sent();
                                    return [4 /*yield*/, client.begin(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, tx.unsafe(sqlContent)];
                                                    case 1:
                                                        _a.sent();
                                                        return [4 /*yield*/, tx(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        INSERT INTO schema_migrations (file_name)\n        VALUES (", ")\n      "], ["\n        INSERT INTO schema_migrations (file_name)\n        VALUES (", ")\n      "])), file)];
                                                    case 2:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 2:
                                    _b.sent();
                                    console.log("Applied migration: ".concat(file));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, migrationFiles_1 = migrationFiles;
                    _a.label = 4;
                case 4:
                    if (!(_i < migrationFiles_1.length)) return [3 /*break*/, 7];
                    file = migrationFiles_1[_i];
                    return [5 /*yield**/, _loop_1(file)];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7:
                    console.log("Migrations are up to date.");
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (error) {
    console.error(error);
    process.exitCode = 1;
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, client.end()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
var templateObject_1, templateObject_2, templateObject_3;
