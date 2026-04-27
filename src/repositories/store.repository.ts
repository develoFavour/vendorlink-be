import { Store, IStore } from "../models/store.model";

export class StoreRepository {
  async create(storeData: Partial<IStore>): Promise<IStore> {
    const store = new Store(storeData);
    return await store.save();
  }

  async findByVendorId(vendorId: string): Promise<IStore | null> {
    return await Store.findOne({ vendorId });
  }

  async findBySlug(slug: string): Promise<IStore | null> {
    return await Store.findOne({ slug });
  }
}

export const storeRepository = new StoreRepository();
