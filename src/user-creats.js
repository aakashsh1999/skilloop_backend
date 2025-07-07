const { faker } = require("@faker-js/faker");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

async function createTwentyUsersWithValidation() {
  console.log("Starting user creation with validation...");

  const skillTypes = [
    "IT",
    "Design",
    "Marketing",
    "Finance",
    "Healthcare",
    "Education",
  ];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < 20; i++) {
    try {
      const gender = faker.helpers.arrayElement(["male", "female"]);
      const firstName = faker.person.firstName(gender);
      const lastName = faker.person.lastName(gender);
      const name = `${firstName} ${lastName}`;

      // Generate unique email to avoid conflicts
      const uniqueEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}@example.com`;
      const uniqueMobile = `9${faker.string.numeric(9)}`;

      const userData = {
        user_type: faker.helpers.arrayElement([
          "Professional",
          "Mentor",
          "Mentee",
        ]),
        name: name,
        gender: gender,
        email: uniqueEmail,
        age: faker.number.int({ min: 22, max: 45 }),
        location: "New Delhi",
        latitude: Number.parseFloat(
          faker.location.latitude({ min: 28.5, max: 28.8, precision: 5 })
        ),
        longitude: Number.parseFloat(
          faker.location.longitude({ min: 77.0, max: 77.3, precision: 5 })
        ),
        profile_image: faker.image.avatar(),
        face: faker.image.urlLoremFlickr({ category: "face" }),
        skill_type: faker.helpers.arrayElement(skillTypes),
        short_bio: faker.lorem.sentence({ min: 10, max: 20 }),
        mobile_number: uniqueMobile,
        avatar: faker.image.avatar(),
        status: faker.helpers.arrayElement(["On", "Pause", "Off"]),
        expoPushToken: faker.string.alphanumeric(22, { casing: "mixed" }),

        // Properly formatted JSON fields
        skills: JSON.stringify({
          primary: faker.lorem.word(),
          secondary: faker.lorem.word(),
        }),

        anything_but_professional: faker.lorem.sentence({ min: 5, max: 15 }),

        business_card: JSON.stringify({
          role: faker.person.jobTitle(),
          company: faker.company.name(),
          phone: uniqueMobile,
          email: uniqueEmail,
          portfolio: faker.internet.url(),
          socialProfiles: [
            {
              id: faker.string.uuid(),
              type: "linkedin",
              value: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
            },
            {
              id: faker.string.uuid(),
              type: "website",
              value: faker.internet.url(),
            },
          ],
        }),

        certificates: JSON.stringify([
          {
            id: faker.string.uuid(),
            title: `${faker.lorem.word()} Certification`,
            organization: faker.company.name(),
            issueDate: faker.date.past().toISOString(),
            certificateUrl: faker.internet.url(),
          },
        ]),

        work_experience: JSON.stringify([
          {
            id: faker.string.uuid(),
            position: faker.person.jobTitle(),
            company: faker.company.name(),
            startDate: faker.date.past({ years: 5 }).toISOString(),
            endDate: faker.datatype.boolean()
              ? faker.date.recent().toISOString()
              : null,
            currentlyWorking: faker.datatype.boolean(),
          },
        ]),

        social_links: JSON.stringify([
          {
            id: faker.string.uuid(),
            type: "instagram",
            value: `https://instagram.com/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
          },
          {
            id: faker.string.uuid(),
            type: "email",
            value: uniqueEmail,
          },
        ]),
      };

      const createdUser = await prisma.user.create({
        data: userData,
      });

      successCount++;
      console.log(
        `✅ Created user ${successCount}: ${createdUser.name} (ID: ${createdUser.id})`
      );
    } catch (error) {
      errorCount++;
      console.error(`❌ Error creating user ${i + 1}:`, error.message);

      // Log specific error details
      if (error.code === "P2002") {
        console.error(
          "   → Unique constraint violation (duplicate email/mobile)"
        );
      } else if (error.code === "P2000") {
        console.error("   → Value too long for column");
      } else {
        console.error("   → Error code:", error.code);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully created: ${successCount} users`);
  console.log(`   ❌ Failed to create: ${errorCount} users`);

  await prisma.$disconnect();
}

// Run the function
if (require.main === module) {
  createTwentyUsersWithValidation().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

createTwentyUsersWithValidation();
