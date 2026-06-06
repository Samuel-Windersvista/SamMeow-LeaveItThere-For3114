import { DependencyContainer } from "tsyringe";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { FileUtils, InitStage, ModHelper } from "./mod_helper";
import { ServerConfig } from "./types";
import _config from "../config.json";
import { ITemplateItem } from "@spt/models/eft/common/tables/ITemplateItem";
import _dbItems from "../db/simple_item_db.json";
import { SimpleItem } from "./types";
import { IBarterScheme } from "@spt/models/eft/common/tables/ITrader";
import { IItem } from "@spt/models/eft/common/tables/IItem";
import { ILocation } from "@spt/models/eft/common/ILocation";
const DbItems = _dbItems as SimpleItem[];
const Config = _config as ServerConfig;

// unheard radio bundle path: "assets/content/items/equipment/item_equipment_radio_h4855/item_equipment_radio_h4855.bundle"

class Mod implements IPreSptLoadMod, IPostDBLoadMod {
    public Helper = new ModHelper();

    public ConfigToServer = "/jehree/home_comforts/config_to_client";
    public GetAllEntryPoints = "/jehree/home_comforts/get_all_entry_points";

    public preSptLoad(container: DependencyContainer): void {
        this.Helper.init(container, InitStage.PRE_SPT_LOAD);

        this.Helper.registerStaticRoute(this.ConfigToServer, "HomeComforts-ConfigToClient", Mod.onConfigToClient, Mod, true);
        this.Helper.registerStaticRoute(this.GetAllEntryPoints, "HomeComforts-GetAllEntryPoints", Mod.getAllEntryPointsString, Mod, true);
    }

    public postDBLoad(container: DependencyContainer): void {
        this.Helper.init(container, InitStage.POST_DB_LOAD);

        for (const item of DbItems) {
            this.addSimpleItemToDb(item);
            this.addSimpleItemToTraderAssort(item);
        }

        for (const langKey in this.Helper.dbLocales.global) {
            const locale = this.Helper.dbLocales.global[langKey];
            locale[`homecomforts_safehouse`] = "Home Comforts Safehouse";
        }
    }

    static onConfigToClient(url: string, info: any, sessionId: string, output: string, helper: ModHelper): string {
        return JSON.stringify(Config);
    }

    static getAllEntryPointsString(url: string, info: any, sessionId: string, output: string, helper: ModHelper): string {
        const allEntryPoints: string[] = [];
        helper.dbLocations.bigmap.base;
        for (const locationKey in helper.dbLocations) {
            if (locationKey === "base") continue;

            const location: ILocation = helper.dbLocations[locationKey];

            allEntryPoints.push(...Mod.getAllPotentialEntryPointsFromLocation(location));
        }

        return JSON.stringify(allEntryPoints);
    }

    static getAllPotentialEntryPointsFromLocation(location: ILocation): string[] {
        const allEntryPoints: string[] = [];

        for (const exit of location.base.exits) {
            const entryPoints: string[] = exit.EntryPoints.split(",");
            allEntryPoints.push(...entryPoints);
        }

        return Array.from(new Set(allEntryPoints));
    }

    addSimpleItemToDb(itemTemplate: SimpleItem): void {
        const multitoolClone: ITemplateItem = FileUtils.jsonClone<ITemplateItem>(this.Helper.dbItems["544fb5454bdc2df8738b456a"]);

        multitoolClone._id = itemTemplate.id;
        multitoolClone._name = itemTemplate.name;
        multitoolClone._props.Name = itemTemplate.name;
        multitoolClone._props.ShortName = itemTemplate.shortName;
        multitoolClone._props.Description = itemTemplate.description;
        multitoolClone._props.Width = itemTemplate.sizeH;
        multitoolClone._props.Height = itemTemplate.sizeV;
        multitoolClone._props.Prefab.path = itemTemplate.bundlePath;
        multitoolClone._props.Weight = itemTemplate.weight;

        this.Helper.dbItems[itemTemplate.id] = multitoolClone;

        this.Helper.dbHandbook.Items.push({
            Id: itemTemplate.id,
            ParentId: "5b47574386f77428ca22b345",
            Price: itemTemplate.fleaPrice,
        });

        for (const langKey in this.Helper.dbLocales.global) {
            const locale = this.Helper.dbLocales.global[langKey];
            locale[`${itemTemplate.id} Name`] = itemTemplate.name;
            locale[`${itemTemplate.id} ShortName`] = itemTemplate.shortName;
            locale[`${itemTemplate.id} Description`] = itemTemplate.description;
        }
    }

    addSimpleItemToTraderAssort(itemTemplate: SimpleItem): void {
        const trader = this.Helper.dbTraders[this.getTraderId(itemTemplate.traderId)];

        const barter: IBarterScheme = {
            count: itemTemplate.cost,
            _tpl: this.getCurrencyId(itemTemplate.currency),
        };

        const item: IItem = {
            _id: itemTemplate.assortId,
            _tpl: itemTemplate.id,
            parentId: "hideout",
            slotId: "hideout",
            upd: {
                UnlimitedCount: true,
                StackObjectsCount: 999999,
                BuyRestrictionMax: 1,
                BuyRestrictionCurrent: 0,
            },
        };

        trader.assort.items.push(item);
        trader.assort.barter_scheme[itemTemplate.assortId] = [[barter]];
        trader.assort.loyal_level_items[itemTemplate.assortId] = itemTemplate.loyaltyLevel;
    }

    getTraderId(traderName: string): string {
        return ModHelper.traderIdsByName[traderName] ?? traderName;
    }

    getCurrencyId(currencyName: string): string {
        return ModHelper.currencyIdsByName[currencyName] ?? currencyName;
    }
}

export const mod = new Mod();
