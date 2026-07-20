package dev.aetherion.block;

import dev.aetherion.registry.ModBlockEntities;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.network.listener.ClientPlayPacketListener;
import net.minecraft.network.packet.Packet;
import net.minecraft.network.packet.s2c.play.BlockEntityUpdateS2CPacket;
import net.minecraft.registry.RegistryWrapper;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.math.BlockPos;

public final class AstralPedestalBlockEntity extends BlockEntity {
	private static final String ITEM_KEY = "item";

	private ItemStack item = ItemStack.EMPTY;

	public AstralPedestalBlockEntity(BlockPos pos, BlockState state) {
		super(ModBlockEntities.ASTRAL_PEDESTAL, pos, state);
	}

	public ItemStack getItem() {
		return item;
	}

	public boolean isEmpty() {
		return item.isEmpty();
	}

	public void setItem(ItemStack stack) {
		item = stack.copyWithCount(1);
		markUpdated();
	}

	public ItemStack takeItem() {
		ItemStack taken = item;
		item = ItemStack.EMPTY;
		markUpdated();
		return taken;
	}

	public void removeOne() {
		if (!item.isEmpty()) {
			item.decrement(1);
			if (item.isEmpty()) {
				item = ItemStack.EMPTY;
			}
			markUpdated();
		}
	}

	private void markUpdated() {
		markDirty();
		if (world != null) {
			world.updateListeners(pos, getCachedState(), getCachedState(), Block.NOTIFY_LISTENERS);
		}
	}

	@Override
	protected void readData(ReadView view) {
		super.readData(view);
		item = view.read(ITEM_KEY, ItemStack.CODEC).orElse(ItemStack.EMPTY);
	}

	@Override
	protected void writeData(WriteView view) {
		super.writeData(view);
		if (!item.isEmpty()) {
			view.put(ITEM_KEY, ItemStack.CODEC, item);
		}
	}

	@Override
	public Packet<ClientPlayPacketListener> toUpdatePacket() {
		return BlockEntityUpdateS2CPacket.create(this);
	}

	@Override
	public NbtCompound toInitialChunkDataNbt(RegistryWrapper.WrapperLookup registries) {
		return createNbt(registries);
	}
}
