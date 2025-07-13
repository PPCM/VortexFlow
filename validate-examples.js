#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import du validateur DOT
const dotValidatorInstance = require('./backend/src/utils/dotValidator');

async function validateAllExamples() {
    console.log('🔍 Validation des Exemples DOT 3D');
    console.log('=====================================\n');
    
    const examplesDir = './docs/dot-3d/examples';
    let totalFiles = 0;
    let validFiles = 0;
    
    try {
        const files = fs.readdirSync(examplesDir)
            .filter(file => file.endsWith('.dot'))
            .sort();
        
        for (const file of files) {
            totalFiles++;
            const filePath = path.join(examplesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            console.log(`📄 ${file}`);
            console.log('-'.repeat(50));
            
            try {
                const result = await dotValidatorInstance.validate(content);
                
                if (result.valid) {
                    console.log('✅ VALIDE');
                    validFiles++;
                } else {
                    console.log('❌ INVALIDE');
                }
                
                if (result.warnings && result.warnings.length > 0) {
                    console.log('\n⚠️  Avertissements:');
                    result.warnings.forEach((warning, index) => {
                        console.log(`  ${index + 1}. ${warning}`);
                    });
                }
                
                if (result.errors && result.errors.length > 0) {
                    console.log('\n🚨 Erreurs:');
                    result.errors.forEach((error, index) => {
                        console.log(`  ${index + 1}. ${error}`);
                    });
                }
                
            } catch (error) {
                console.log(`❌ ERREUR DE PARSING: ${error.message}`);
            }
            
            console.log('\n');
        }
        
        console.log('📊 RÉSUMÉ');
        console.log('=========');
        console.log(`Total fichiers: ${totalFiles}`);
        console.log(`Fichiers valides: ${validFiles}`);
        console.log(`Fichiers avec problèmes: ${totalFiles - validFiles}`);
        console.log(`Taux de succès: ${((validFiles / totalFiles) * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ Erreur lors de la validation:', error.message);
        process.exit(1);
    }
}

// Test d'un fichier spécifique si fourni en argument
async function validateSingleFile() {
    const testFile = process.argv[2];
    const filePath = path.join('./docs/dot-3d/examples', testFile);
    
    if (fs.existsSync(filePath)) {
        console.log(`🔍 Test du fichier: ${testFile}`);
        console.log('='.repeat(40));
        
        const content = fs.readFileSync(filePath, 'utf8');
        const result = await dotValidatorInstance.validate(content);
        
        console.log('\n📄 Contenu analysé:');
        console.log('-'.repeat(20));
        console.log(content.substring(0, 200) + '...\n');
        
        console.log('📋 Résultat de validation:');
        console.log('-'.repeat(25));
        console.log('Valide:', result.valid ? '✅' : '❌');
        
        if (result.warnings?.length > 0) {
            console.log('\n⚠️  Avertissements:');
            result.warnings.forEach((w, i) => console.log(`  ${i+1}. ${w}`));
        }
        
        if (result.errors?.length > 0) {
            console.log('\n🚨 Erreurs:');
            result.errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
        }
    } else {
        console.error(`❌ Fichier non trouvé: ${filePath}`);
        process.exit(1);
    }
}

if (process.argv[2]) {
    const testFile = process.argv[2];
    const filePath = path.join('./docs/dot-3d/examples', testFile);
    
    if (fs.existsSync(filePath)) {
        console.log(`🔍 Test du fichier: ${testFile}`);
        console.log('='.repeat(40));
        
        const content = fs.readFileSync(filePath, 'utf8');
        const result = dotValidatorInstance.validate(content);
        
        console.log('\n📄 Contenu analysé:');
        console.log('-'.repeat(20));
        console.log(content.substring(0, 200) + '...\n');
        
        console.log('📋 Résultat de validation:');
        console.log('-'.repeat(25));
        console.log('Valide:', result.valid ? '✅' : '❌');
        
        if (result.warnings?.length > 0) {
            console.log('\n⚠️  Avertissements:');
            result.warnings.forEach((w, i) => console.log(`  ${i+1}. ${w}`));
        }
        
        if (result.errors?.length > 0) {
            console.log('\n🚨 Erreurs:');
            result.errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
        }
    } else {
        console.error(`❌ Fichier non trouvé: ${filePath}`);
        process.exit(1);
    }
} else {
    validateAllExamples();
}
