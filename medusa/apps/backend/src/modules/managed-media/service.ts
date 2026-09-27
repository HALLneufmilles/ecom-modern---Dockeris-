import { MedusaService } from "@medusajs/framework/utils"
import ManagedMedia from "./models/managed-media"

class ManagedMediaModuleService extends MedusaService({
  ManagedMedia,
}) {}

export default ManagedMediaModuleService
