import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

const prisma = new PrismaClient();

const seedEnvironment = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12),
  SEED_CUSTOMER_PASSWORD: z.string().min(12),
});

const categories = [
  {
    name: "Home & Living",
    slug: "home-living",
    description: "Thoughtful pieces for calm, comfortable spaces.",
    children: [
      ["Decor & Objects", "decor-objects"],
      ["Storage & Organization", "storage-organization"],
    ],
  },
  {
    name: "Kitchen",
    slug: "kitchen",
    description: "Everyday tools for cooking, serving, and gathering.",
    children: [
      ["Cookware", "cookware"],
      ["Tableware", "tableware"],
    ],
  },
  {
    name: "Textiles",
    slug: "textiles",
    description: "Soft, durable fabrics made for daily use.",
    children: [
      ["Bed & Bath", "bed-bath"],
      ["Bags & Linens", "bags-linens"],
    ],
  },
  {
    name: "Personal Care",
    slug: "personal-care",
    description: "Simple, dependable essentials for everyday routines.",
    children: [
      ["Bath & Body", "bath-body"],
      ["Personal Accessories", "personal-accessories"],
    ],
  },
  {
    name: "Outdoor",
    slug: "outdoor",
    description: "Useful gear for fresh air and weekends away.",
    children: [
      ["Travel", "travel"],
      ["Garden", "garden"],
    ],
  },
  {
    name: "Stationery",
    slug: "stationery",
    description: "Paper goods and desk tools for clear thinking.",
    children: [
      ["Paper Goods", "paper-goods"],
      ["Desk Accessories", "desk-accessories"],
    ],
  },
  {
    name: "Lighting",
    slug: "lighting",
    description: "Warm, practical light for work and winding down.",
    children: [
      ["Table Lighting", "table-lighting"],
      ["Portable Lighting", "portable-lighting"],
    ],
  },
  {
    name: "Accessories",
    slug: "accessories",
    description: "Considered finishing touches for home and on the go.",
    children: [
      ["Everyday Carry", "everyday-carry"],
      ["Small Accessories", "small-accessories"],
    ],
  },
] as const;

const brands = [
  { name: "North & Pine", slug: "north-and-pine" },
  { name: "Fieldwork", slug: "fieldwork" },
  { name: "Forma Studio", slug: "forma-studio" },
  { name: "Kindred Goods", slug: "kindred-goods" },
  { name: "Stillwell", slug: "stillwell" },
] as const;

const productNames = [
  ["Hand-thrown Stoneware Vase", "Reclaimed Oak Catchall Tray", "Linen Shade Table Lamp", "Woven Storage Basket", "Solid Wood Book Stand"],
  ["Cast Iron Everyday Skillet", "Acacia Serving Board", "Stackable Ceramic Mug Set", "Recycled Glass Carafe", "Stainless Steel Prep Tool Set"],
  ["Organic Cotton Bath Towel", "Linen Pillow Cover Pair", "Canvas Market Tote", "Waffle Weave Hand Towel Set", "Natural Linen Table Runner"],
  ["Botanical Hand Wash", "Unscented Body Balm", "Cedar Soap Dish", "Cotton Travel Wash Kit", "Gentle Daily Hand Cream"],
  ["Insulated Travel Bottle", "Packable Picnic Blanket", "Canvas Garden Apron", "Stainless Camp Cup Pair", "Leather-Free Travel Pouch"],
  ["Recycled Paper Notebook Set", "Linen-Bound Daily Journal", "Brass Desk Ruler", "Undated Weekly Planner", "Cork Desk Organizer"],
  ["Ceramic Bedside Lamp", "Rechargeable Reading Light", "Pleated Linen Pendant Shade", "Dimmable Desk Light", "Portable Ambient Lantern"],
  ["Everyday Canvas Pouch", "Recycled Key Clip", "Slim Card Wallet", "Woven Luggage Tag Set", "Cotton Utility Zip Bag"],
] as const;

const categoryDescriptions = [
  "A considered everyday piece, made with durable materials and a quiet, versatile design. Carefully selected to work beautifully in real homes.",
  "A dependable essential for cooking and gathering. Thoughtful materials, comfortable details, and a finish that feels right at home.",
  "Soft, breathable, and made for regular use. A timeless textile with considered construction and an easy, natural feel.",
  "A gentle everyday essential with a straightforward formula and considered packaging. Designed to make daily routines feel a little calmer.",
  "Practical gear made for time outside. Lightweight, dependable, and ready for everyday adventures close to home.",
  "A useful companion for notes, plans, and creative work. Carefully finished with materials chosen for how they feel and hold up.",
  "Warm, considered light for the moments that make a house feel like home. A balance of useful function and quiet form.",
  "A small, useful accessory made to travel well and earn its place in your everyday routine.",
] as const;

const customers = [
  { name: "Avery Morgan", email: "avery.morgan@example.com" },
  { name: "Jordan Lee", email: "jordan.lee@example.com" },
  { name: "Riley Taylor", email: "riley.taylor@example.com" },
] as const;

const reviews = [
  {
    customerEmail: customers[0].email,
    productSlug: "hand-thrown-stoneware-vase",
    rating: 5,
    title: "A lovely everyday piece",
    comment: "The shape and glaze are even more beautiful in person. It feels substantial without being heavy.",
  },
  {
    customerEmail: customers[1].email,
    productSlug: "acacia-serving-board",
    rating: 4,
    title: "Well made and useful",
    comment: "A simple, sturdy board that looks good on the counter and cleans up easily.",
  },
  {
    customerEmail: customers[2].email,
    productSlug: "organic-cotton-bath-towel",
    rating: 5,
    title: "Soft from the first wash",
    comment: "Comfortable, absorbent, and a nice weight. I would happily add another set.",
  },
] as const;

async function main() {
  const environment = seedEnvironment.parse(process.env);
  const adminEmail = environment.ADMIN_EMAIL.toLowerCase();
  const [adminPasswordHash, customerPasswordHash] = await Promise.all([
    hash(environment.ADMIN_PASSWORD, 12),
    hash(environment.SEED_CUSTOMER_PASSWORD, 12),
  ]);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: "Store Administrator",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      emailVerified: new Date(),
      role: UserRole.ADMIN,
    },
    update: {
      name: "Store Administrator",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  for (const customer of customers) {
    await prisma.user.upsert({
      where: { email: customer.email },
      create: {
        name: customer.name,
        email: customer.email,
        passwordHash: customerPasswordHash,
        emailVerified: new Date(),
      },
      update: {
        name: customer.name,
        passwordHash: customerPasswordHash,
      },
    });
  }

  const categoryIds = new Map<string, string>();
  for (const [parentIndex, parent] of categories.entries()) {
    const parentRecord = await prisma.category.upsert({
      where: { slug: parent.slug },
      create: {
        name: parent.name,
        slug: parent.slug,
        description: parent.description,
        image: `https://picsum.photos/seed/category-${parent.slug}/1200/800`,
        sortOrder: parentIndex,
        isActive: true,
      },
      update: {
        name: parent.name,
        description: parent.description,
        sortOrder: parentIndex,
        isActive: true,
      },
    });
    categoryIds.set(parent.slug, parentRecord.id);

    for (const [childIndex, [name, slug]] of parent.children.entries()) {
      const childRecord = await prisma.category.upsert({
        where: { slug },
        create: {
          name,
          slug,
          parentId: parentRecord.id,
          description: `${name} selected for considered everyday use.`,
          image: `https://picsum.photos/seed/category-${slug}/1200/800`,
          sortOrder: childIndex,
          isActive: true,
        },
        update: {
          name,
          parentId: parentRecord.id,
          description: `${name} selected for considered everyday use.`,
          sortOrder: childIndex,
          isActive: true,
        },
      });
      categoryIds.set(slug, childRecord.id);
    }
  }

  const brandIds = new Map<string, string>();
  for (const brand of brands) {
    const record = await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: brand,
      update: { name: brand.name },
    });
    brandIds.set(brand.slug, record.id);
  }

  const colorNames = ["Natural", "Olive", "Stone"] as const;
  for (const [groupIndex, names] of productNames.entries()) {
    const parent = categories[groupIndex];
    const childSlugs = parent.children.map(([, slug]) => slug);

    for (const [productIndex, name] of names.entries()) {
      const slug = name
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const sku = `ST-${String(groupIndex + 1).padStart(2, "0")}-${String(productIndex + 1).padStart(2, "0")}`;
      const brand = brands[(groupIndex * names.length + productIndex) % brands.length];
      const price = new Prisma.Decimal(18 + groupIndex * 4 + productIndex * 7);
      const compareAtPrice =
        productIndex % 2 === 0
          ? price.mul(new Prisma.Decimal("1.2")).toDecimalPlaces(2)
          : null;
      const categoryId = categoryIds.get(childSlugs[productIndex % childSlugs.length]);
      const brandId = brandIds.get(brand.slug);
      if (!categoryId || !brandId) {
        throw new Error(`Seed references a missing category or brand for "${name}".`);
      }

      const description =
        `${name} — ${categoryDescriptions[groupIndex]} Designed with lasting usefulness in mind and carefully chosen for an uncomplicated, considered home.`;
      const imageRecords = [1, 2, 3].map((imageIndex) => ({
        url: `https://picsum.photos/seed/${slug}-${imageIndex}/1200/1200`,
        alt: `${name}, view ${imageIndex}`,
        sortOrder: imageIndex - 1,
        isPrimary: imageIndex === 1,
      }));

      const product = await prisma.product.upsert({
        where: { slug },
        create: {
          name,
          slug,
          description,
          brandId,
          basePrice: price,
          compareAtPrice,
          sku,
          status: "ACTIVE",
          isFeatured: (groupIndex + productIndex) % 5 === 0,
          seoTitle: `${name} | Thoughtful everyday essentials`,
          seoDescription: `Discover the ${name.toLowerCase()}, selected for considered design, dependable quality, and everyday use.`,
          categories: {
            create: { categoryId, isPrimary: true },
          },
          images: { create: imageRecords },
        },
        update: {
          name,
          description,
          brandId,
          basePrice: price,
          compareAtPrice,
          status: "ACTIVE",
          isFeatured: (groupIndex + productIndex) % 5 === 0,
          seoTitle: `${name} | Thoughtful everyday essentials`,
          seoDescription: `Discover the ${name.toLowerCase()}, selected for considered design, dependable quality, and everyday use.`,
        },
      });

      await prisma.productCategory.deleteMany({ where: { productId: product.id } });
      await prisma.productCategory.create({
        data: { productId: product.id, categoryId, isPrimary: true },
      });
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      await prisma.productImage.createMany({
        data: imageRecords.map((image) => ({ ...image, productId: product.id })),
      });

      for (const [colorIndex, color] of colorNames.entries()) {
        const variantSku = `${sku}-${color.toUpperCase()}`;
        await prisma.productVariant.upsert({
          where: { sku: variantSku },
          create: {
            productId: product.id,
            size: "One size",
            color,
            sku: variantSku,
            stock: 12 + ((groupIndex * 7 + productIndex * 3 + colorIndex * 5) % 37),
            image: imageRecords[colorIndex].url,
          },
          update: {
            productId: product.id,
            size: "One size",
            color,
            stock: 12 + ((groupIndex * 7 + productIndex * 3 + colorIndex * 5) % 37),
            image: imageRecords[colorIndex].url,
          },
        });
      }

      const specifications = [
        ["Materials", ["Natural materials", "Recycled materials", "Organic cotton", "Stainless steel"][groupIndex % 4]],
        ["Care", ["Wipe clean with a soft cloth", "Hand wash and dry thoroughly", "Machine wash cold, line dry", "Store in a cool, dry place"][groupIndex % 4]],
        ["Origin", ["Designed with care", "Responsibly selected", "Made for everyday use"][productIndex % 3]],
      ];
      for (const [key, value] of specifications) {
        await prisma.productAttribute.upsert({
          where: { productId_key: { productId: product.id, key } },
          create: { productId: product.id, key, value },
          update: { value },
        });
      }
    }
  }

  for (const review of reviews) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: review.customerEmail },
    });
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: review.productSlug },
    });
    await prisma.review.upsert({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      create: {
        userId: user.id,
        productId: product.id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        isVerifiedPurchase: false,
        status: "APPROVED",
      },
      update: {
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        isVerifiedPurchase: false,
        status: "APPROVED",
      },
    });
  }

  const coupons = [
    { code: "WELCOME10", type: "PERCENT" as const, value: 10, minOrder: 40, maxDiscount: 30, perUserLimit: 1 },
    { code: "SPRING15", type: "PERCENT" as const, value: 15, minOrder: 75, maxDiscount: 50, perUserLimit: 2 },
    { code: "TAKE20", type: "FIXED" as const, value: 20, minOrder: 120, maxDiscount: null, perUserLimit: 1 },
  ];
  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      create: {
        ...coupon,
        value: new Prisma.Decimal(coupon.value),
        minOrder: new Prisma.Decimal(coupon.minOrder),
        maxDiscount: coupon.maxDiscount ? new Prisma.Decimal(coupon.maxDiscount) : null,
        usageLimit: 500,
        isActive: true,
      },
      update: {
        ...coupon,
        value: new Prisma.Decimal(coupon.value),
        minOrder: new Prisma.Decimal(coupon.minOrder),
        maxDiscount: coupon.maxDiscount ? new Prisma.Decimal(coupon.maxDiscount) : null,
        usageLimit: 500,
        isActive: true,
      },
    });
  }

  const banners = [
    { title: "Useful things, chosen with care", position: "HERO" as const, sortOrder: 0 },
    { title: "Find a little more calm at home", position: "FEATURED" as const, sortOrder: 0 },
    { title: "Everyday essentials, made to last", position: "PROMOTION" as const, sortOrder: 0 },
  ];
  for (const banner of banners) {
    await prisma.banner.upsert({
      where: { id: `seed-banner-${banner.position.toLowerCase()}` },
      create: {
        id: `seed-banner-${banner.position.toLowerCase()}`,
        ...banner,
        image: `https://picsum.photos/seed/banner-${banner.position.toLowerCase()}/1800/800`,
        isActive: true,
        link: "/products",
      },
      update: {
        ...banner,
        image: `https://picsum.photos/seed/banner-${banner.position.toLowerCase()}/1800/800`,
        isActive: true,
        link: "/products",
      },
    });
  }

  const shippingMethods = [
    { name: "Standard Shipping", type: "STANDARD" as const, amount: 6 },
    { name: "Express Shipping", type: "EXPRESS" as const, amount: 14 },
    { name: "Local Pickup", type: "PICKUP" as const, amount: 0 },
  ];
  for (const method of shippingMethods) {
    await prisma.shippingMethod.upsert({
      where: { name: method.name },
      create: {
        name: method.name,
        type: method.type,
        isActive: true,
        sortOrder: method.type === "STANDARD" ? 0 : method.type === "EXPRESS" ? 1 : 2,
        rates: {
          create: {
            country: "US",
            state: "",
            amount: new Prisma.Decimal(method.amount),
            currency: "USD",
          },
        },
      },
      update: {
        type: method.type,
        isActive: true,
        sortOrder: method.type === "STANDARD" ? 0 : method.type === "EXPRESS" ? 1 : 2,
        rates: {
          deleteMany: {},
          create: {
            country: "US",
            state: "",
            amount: new Prisma.Decimal(method.amount),
            currency: "USD",
          },
        },
      },
    });
  }

  const settings = [
    { key: "store", value: { currency: "USD", locale: "en-US", taxEnabled: false } },
    { key: "contact", value: { email: "hello@example.com", phone: "" } },
    { key: "shipping", value: { freeShippingThreshold: 100, defaultCountry: "US" } },
  ] satisfies { key: string; value: Prisma.InputJsonValue }[];
  for (const setting of settings) {
    await prisma.storeSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: { value: setting.value },
    });
  }

  const [userCount, categoryCount, brandCount, productCount, imageCount, variantCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.brand.count(),
      prisma.product.count(),
      prisma.productImage.count(),
      prisma.productVariant.count(),
    ]);
  console.info("Seed completed successfully.", {
    users: userCount,
    categories: categoryCount,
    brands: brandCount,
    products: productCount,
    productImages: imageCount,
    variants: variantCount,
    reviews: await prisma.review.count(),
    coupons: await prisma.coupon.count(),
    banners: await prisma.banner.count(),
    shippingMethods: await prisma.shippingMethod.count(),
    storeSettings: await prisma.storeSetting.count(),
  });
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
