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

public final class AstralAltarBlockEntity extends BlockEntity {
	private static final String CATALYST_KEY = "catalyst";

	private ItemStack catalyst = ItemStack.EMPTY;

	public AstralAltarBlockEntity(BlockPos pos, BlockState state) {
		super(ModBlockEntities.ASTRAL_ALTAR, pos, state);
	}

	public ItemStack getCatalyst() {
		return catalyst;
	}

	public boolean isEmpty() {
		return catalyst.isEmpty();
	}

	public void setCatalyst(ItemStack stack) {
		catalyst = stack.copyWithCount(1);
		markUpdated();
	}

	public ItemStack takeCatalyst() {
		ItemStack taken = catalyst;
		catalyst = ItemStack.EMPTY;
		markUpdated();
		return taken;
	}

	public void consumeCatalyst() {
		if (!catalyst.isEmpty()) {
			catalyst.decrement(1);
			if (catalyst.isEmpty()) {
				catalyst = ItemStack.EMPTY;
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
		catalyst = view.read(CATALYST_KEY, ItemStack.CODEC).orElse(ItemStack.EMPTY);
	}

	@Override
	protected void writeData(WriteView view) {
		super.writeData(view);
		if (!catalyst.isEmpty()) {
			view.put(CATALYST_KEY, ItemStack.CODEC, catalyst);
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
