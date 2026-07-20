package dev.aetherion.client.particle;

import net.minecraft.client.particle.AnimatedParticle;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleFactory;
import net.minecraft.client.particle.SpriteProvider;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.util.math.random.Random;

public final class AetherionParticle extends AnimatedParticle {
	private final Style style;
	private final float initialScale;

	private AetherionParticle(
			ClientWorld world,
			double x,
			double y,
			double z,
			double velocityX,
			double velocityY,
			double velocityZ,
			SpriteProvider sprites,
			Style style,
			Random random
	) {
		super(world, x, y, z, sprites, style.gravity);
		this.style = style;
		this.velocityX = velocityX;
		this.velocityY = velocityY;
		this.velocityZ = velocityZ;
		this.velocityMultiplier = style.velocityMultiplier;
		this.collidesWithWorld = style.collidesWithWorld;
		this.scale = style.scale * (0.8F + random.nextFloat() * 0.4F);
		this.initialScale = scale;
		this.maxAge = style.minAge + random.nextInt(style.ageVariation + 1);
		setColor(style.color);
		setTargetColor(style.targetColor);
		updateSprite(sprites);
	}

	@Override
	public void tick() {
		super.tick();
		if (!isAlive()) {
			return;
		}

		float life = (float) age / (float) maxAge;
		scale = style == Style.STELLAR_BURST
				? initialScale * (1.0F + life * 2.4F)
				: initialScale * (1.0F - life * 0.45F);
		if (style == Style.RIFT_SPARK) {
			zRotation += 0.32F;
		}
	}

	private enum Style {
		STARLIGHT_MOTE(0xF5C542, 0x33E0FF, 0.11F, 32, 20, 0.0F, 0.96F, false),
		RIFT_SPARK(0x8B5CF6, 0x33E0FF, 0.15F, 16, 10, 0.0F, 0.90F, false),
		STELLAR_BURST(0xF5C542, 0x8B5CF6, 0.28F, 10, 6, 0.0F, 0.84F, false);

		private final int color;
		private final int targetColor;
		private final float scale;
		private final int minAge;
		private final int ageVariation;
		private final float gravity;
		private final float velocityMultiplier;
		private final boolean collidesWithWorld;

		Style(
				int color,
				int targetColor,
				float scale,
				int minAge,
				int ageVariation,
				float gravity,
				float velocityMultiplier,
				boolean collidesWithWorld
		) {
			this.color = color;
			this.targetColor = targetColor;
			this.scale = scale;
			this.minAge = minAge;
			this.ageVariation = ageVariation;
			this.gravity = gravity;
			this.velocityMultiplier = velocityMultiplier;
			this.collidesWithWorld = collidesWithWorld;
		}
	}

	private abstract static class Factory implements ParticleFactory<SimpleParticleType> {
		private final SpriteProvider sprites;
		private final Style style;

		private Factory(SpriteProvider sprites, Style style) {
			this.sprites = sprites;
			this.style = style;
		}

		@Override
		public Particle createParticle(
				SimpleParticleType type,
				ClientWorld world,
				double x,
				double y,
				double z,
				double velocityX,
				double velocityY,
				double velocityZ,
				Random random
		) {
			return new AetherionParticle(
					world,
					x,
					y,
					z,
					velocityX,
					velocityY,
					velocityZ,
					sprites,
					style,
					random
			);
		}
	}

	public static final class StarlightMoteFactory extends Factory {
		public StarlightMoteFactory(SpriteProvider sprites) {
			super(sprites, Style.STARLIGHT_MOTE);
		}
	}

	public static final class RiftSparkFactory extends Factory {
		public RiftSparkFactory(SpriteProvider sprites) {
			super(sprites, Style.RIFT_SPARK);
		}
	}

	public static final class StellarBurstFactory extends Factory {
		public StellarBurstFactory(SpriteProvider sprites) {
			super(sprites, Style.STELLAR_BURST);
		}
	}
}
