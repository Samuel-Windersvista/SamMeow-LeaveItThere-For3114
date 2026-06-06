export type SimpleItem = {
    id: string;
    shortName: string;
    name: string;
    description: string;
    sizeH: number;
    sizeV: number;
    weight: number;
    traderId: string;
    assortId: string;
    loyaltyLevel: number;
    currency: string;
    cost: number;
    fleaPrice: number;
    bundlePath: string;
};

export type ServerConfig = {
    SafehouseItemIds: string[];
    SpaceHeaterItemIds: string[];
};
