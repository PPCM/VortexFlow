#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import du validateur DOT
const dotValidatorInstance = require('./backend/src/utils/dotValidator');

async function validateAllExamples() {
    console.log('🔍 Validation des Exemples DOT 3D');
    console.log('=====================================');
    
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
            
            console.log(`\n📄 ${file}`);
            console.log('-'.repeat(50));
            
            try {
                const result = await dotValidatorInstance.validate(content);
                
                if (result.valid) {
                    console.log('✅ VALIDE');
                    validFiles++;
                } else {
                    console.log('❌ INVALIDE');
                    
                    if (result.errors?.length > 0) {
                        console.log('\n🚨 Erreurs:');
                        result.errors.forEach((error, i) => {
                            console.log(`  ${i+1}. ${error}`);
                        });
                    }
                }
                
                if (result.warnings?.length > 0) {
                    console.log('\n⚠️  Avertissements:');
                    result.warnings.forEach((warning, i) => {
                        console.log(`  ${i+1}. ${warning}`);
                    });
                }
                
            } catch (error) {
                console.log('❌ ERREUR DE VALIDATION');
                console.log(`   ${error.message}`);
            }
        }
        
        // Résumé final
        console.log('\n📊 RÉSUMÉ');
        console.log('=========');
        console.log(`Total fichiers: ${totalFiles}`);
        console.log(`Fichiers valides: ${validFiles}`);
        console.log(`Fichiers avec problèmes: ${totalFiles - validFiles}`);
        console.log(`Taux de succès: ${((validFiles / totalFiles) * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ Erreur lors de la lecture du dossier:', error.message);
        process.exit(1);
    }
}

async function validateSingleFile(filename) {
    const filePath = path.join('./docs/dot-3d/examples', filename);
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Fichier non trouvé: ${filePath}`);
        process.exit(1);
    }
    
    console.log(`🔍 Test du fichier: ${filename}`);
    console.log('='.repeat(40));
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('\n📄 Contenu analysé:');
    console.log('-'.repeat(20));
    console.log(content.substring(0, 200) + '...\n');
    
    try {
        const result = await dotValidatorInstance.validate(content);
        
        console.log('📋 Résultat de validation:');
        console.log('-'.repeat(25));
        console.log('Valide:', result.valid ? '✅' : '❌');
        
        if (result.errors?.length > 0) {
            console.log('\n🚨 Erreurs:');
            result.errors.forEach((error, i) => {
                console.log(`  ${i+1}. ${error}`);
            });
        }
        
        if (result.warnings?.length > 0) {
            console.log('\n⚠️  Avertissements:');
            result.warnings.forEach((warning, i) => {
                console.log(`  ${i+1}. ${warning}`);
            });
        }
        
        // Affichage des métadonnées
        if (result.metadata) {
            console.log('\n📈 Métadonnées:');
            console.log(`  - Type: ${result.metadata.type || 'Non détecté'}`);
            console.log(`  - Nœuds: ${result.metadata.nodeCount || 0}`);
            console.log(`  - Liens: ${result.metadata.edgeCount || 0}`);
            console.log(`  - Extensions VortexFlow: ${result.metadata.hasVortexFlowExtensions ? 'Oui' : 'Non'}`);
        }
        
    } catch (error) {
        console.log('❌ ERREUR DE VALIDATION');
        console.log(`   ${error.message}`);
        console.error(error.stack);
    }
}

// Main execution
async function main() {
    if (process.argv[2]) {
        await validateSingleFile(process.argv[2]);
    } else {
        await validateAllExamples();
    }
}

main().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    console.error(error.stack);
    process.exit(1);
});
